import { categorize } from "./categories";
import {
  clearStore,
  getAllChannels,
  getFavorites,
  getHistory,
  getKv,
  getPlaylists,
  getStatuses,
  putMany,
  replacePlaylistChannels,
  setKv,
  wipeAll,
} from "./db";
import {
  DEFAULT_META,
  DEFAULT_SETTINGS,
  type BackupFile,
  type Channel,
  type FavoriteEntry,
  type HistoryEntry,
  type Meta,
  type Playlist,
  type Settings,
  type StatusEntry,
} from "./types";

const STREAM_RE = /^(https?|rtmps?|rtsp|udp|rtp|mmsh?|srt):\/\//i;
const ID_RE = /^[A-Za-z0-9_-]+$/;

const str = (v: unknown, max: number) =>
  typeof v === "string"
    ? // eslint-disable-next-line no-control-regex
      v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

export async function buildBackup(kind: BackupFile["kind"]): Promise<BackupFile> {
  const base: BackupFile = { app: "NEXA IPTV", version: 1, kind, exportedAt: Date.now() };
  const [settings, meta] = await Promise.all([
    getKv<Settings>("settings", DEFAULT_SETTINGS),
    getKv<Meta>("meta", DEFAULT_META),
  ]);
  if (kind === "config") return { ...base, settings, meta };
  const [playlists, channels, favorites] = await Promise.all([getPlaylists(), getAllChannels(), getFavorites()]);
  if (kind === "playlists") return { ...base, playlists, channels, favorites };
  const [history, status] = await Promise.all([getHistory(), getStatuses()]);
  return { ...base, settings, meta, playlists, channels, favorites, history, status };
}

export class BackupError extends Error {}

/** Valida estructura y sanea todos los campos (no se confía en el archivo). */
export function parseBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== "object") throw new BackupError("El archivo no es una copia de seguridad válida.");
  const o = raw as Record<string, unknown>;
  if (o.app !== "NEXA IPTV" || o.version !== 1) {
    throw new BackupError("El archivo no pertenece a NEXA IPTV o su versión no es compatible.");
  }
  const kind = o.kind === "config" || o.kind === "playlists" || o.kind === "full" ? o.kind : "full";
  const out: BackupFile = { app: "NEXA IPTV", version: 1, kind, exportedAt: num(o.exportedAt, Date.now()) };

  if (o.settings && typeof o.settings === "object") {
    out.settings = { ...DEFAULT_SETTINGS, ...(o.settings as Partial<Settings>) };
  }
  if (o.meta && typeof o.meta === "object") {
    out.meta = { ...DEFAULT_META, ...(o.meta as Partial<Meta>) };
  }

  if (Array.isArray(o.playlists)) {
    out.playlists = [];
    for (const p of o.playlists as Record<string, unknown>[]) {
      const id = str(p?.id, 40);
      if (!ID_RE.test(id)) continue;
      out.playlists.push({
        id,
        name: str(p.name, 80) || "Lista importada",
        sourceType: p.sourceType === "url" ? "url" : "file",
        source: str(p.source, 600),
        enabled: p.enabled !== false,
        importedAt: num(p.importedAt, Date.now()),
        updatedAt: num(p.updatedAt, Date.now()),
        channelCount: 0,
        contentHash: str(p.contentHash, 64),
        duplicatesRemoved: num(p.duplicatesRemoved),
      });
    }
  }

  if (Array.isArray(o.channels)) {
    const ids = new Set((out.playlists ?? []).map((p) => p.id));
    out.channels = [];
    for (const c of o.channels as Record<string, unknown>[]) {
      const id = str(c?.id, 120);
      const playlistId = str(c?.playlistId, 40);
      const url = str(c?.url, 2000);
      if (!ids.has(playlistId) || !id.startsWith(playlistId + ":") || !STREAM_RE.test(url)) continue;
      const logo = str(c.logo, 600);
      const group = str(c.group, 120);
      out.channels.push({
        id,
        playlistId,
        name: str(c.name, 200) || "Canal",
        altName: str(c.altName, 200),
        tvgId: str(c.tvgId, 120),
        logo: /^https?:\/\//i.test(logo) ? logo : "",
        group,
        category: categorize(group),
        language: str(c.language, 60),
        country: str(c.country, 60),
        url,
        order: num(c.order),
      });
    }
    const counts = new Map<string, number>();
    for (const c of out.channels) counts.set(c.playlistId, (counts.get(c.playlistId) ?? 0) + 1);
    for (const p of out.playlists ?? []) p.channelCount = counts.get(p.id) ?? 0;
  }

  const idOk = (v: unknown) => typeof v === "string" && v.length < 160 && v.includes(":");
  if (Array.isArray(o.favorites)) {
    out.favorites = (o.favorites as FavoriteEntry[])
      .filter((f) => idOk(f?.id))
      .map((f) => ({ id: f.id, addedAt: num(f.addedAt, Date.now()) }));
  }
  if (Array.isArray(o.history)) {
    out.history = (o.history as HistoryEntry[])
      .filter((h) => idOk(h?.id))
      .map((h) => ({
        id: h.id,
        playedAt: num(h.playedAt, Date.now()),
        count: Math.max(1, num(h.count, 1)),
        name: str(h.name, 200),
        logo: /^https?:\/\//i.test(str(h.logo, 600)) ? str(h.logo, 600) : "",
      }));
  }
  if (Array.isArray(o.status)) {
    out.status = (o.status as StatusEntry[])
      .filter((s) => idOk(s?.id))
      .map((s) => ({ id: s.id, ok: !!s.ok, at: num(s.at, Date.now()) }));
  }

  if (!out.settings && !out.meta && !out.playlists && !out.favorites && !out.history) {
    throw new BackupError("La copia de seguridad no contiene datos que restaurar.");
  }
  return out;
}

export interface RestoreSummary {
  playlists: number;
  channels: number;
  favorites: number;
  history: number;
  settings: boolean;
}

/** Restaura (fusionando, o reemplazando todo si `replace`) una copia ya validada. */
export async function restoreBackup(b: BackupFile, replace = false): Promise<RestoreSummary> {
  if (replace) await wipeAll();
  const summary: RestoreSummary = { playlists: 0, channels: 0, favorites: 0, history: 0, settings: false };

  if (b.playlists) {
    const byPlaylist = new Map<string, Channel[]>();
    for (const c of b.channels ?? []) {
      const l = byPlaylist.get(c.playlistId) ?? [];
      l.push(c);
      byPlaylist.set(c.playlistId, l);
    }
    for (const p of b.playlists as Playlist[]) {
      if (b.channels) {
        await replacePlaylistChannels(p.id, byPlaylist.get(p.id) ?? [], p);
        summary.channels += byPlaylist.get(p.id)?.length ?? 0;
      } else {
        await putMany("playlists", [p]);
      }
      summary.playlists++;
    }
  }
  if (b.favorites) {
    await putMany("favorites", b.favorites);
    summary.favorites = b.favorites.length;
  }
  if (b.history) {
    await putMany("history", b.history);
    summary.history = b.history.length;
  }
  if (b.status) await putMany("status", b.status);
  if (b.settings) {
    await setKv("settings", b.settings);
    summary.settings = true;
  }
  if (b.meta) await setKv("meta", { ...b.meta, lastChannelId: b.meta.lastChannelId });
  return summary;
}

export const clearHistoryStore = () => clearStore("history");
