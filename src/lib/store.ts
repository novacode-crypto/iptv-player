import { useMemo } from "react";
import { create } from "zustand";
import {
  buildBackup,
  BackupError,
  parseBackup,
  restoreBackup,
  type RestoreSummary,
} from "./backup";
import { DEMO_M3U } from "./demo";
import {
  clearStore,
  deleteOne,
  getChannelsByPlaylist,
  getFavorites,
  getHistory,
  getKv,
  getAllChannels,
  getPlaylists,
  getStatuses,
  putOne,
  setKv,
  wipeAll,
  describeDbError,
} from "./db";
import {
  importFromText,
  importSource,
  removePlaylist,
  renamePlaylist,
  setPlaylistEnabled,
  updatePlaylist,
  type ImportInput,
} from "./playlist-manager";
import { navigate } from "./router";
import {
  DEFAULT_META,
  DEFAULT_SETTINGS,
  type BackupFile,
  type Channel,
  type HistoryEntry,
  type ImportJob,
  type IndexedChannel,
  type Meta,
  type Playlist,
  type Settings,
} from "./types";
import { downloadJson, normalize, uid } from "./utils";

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  message: string;
}

const HISTORY_LIMIT = 200;

function index(c: Channel): IndexedChannel {
  return {
    ...c,
    _s: normalize([c.name, c.altName, c.group, c.category, c.tvgId, c.language, c.country].join(" ")),
  };
}

interface State {
  ready: boolean;
  fatalError: string | null;
  playlists: Playlist[];
  channels: IndexedChannel[];
  channelMap: Map<string, IndexedChannel>;
  favorites: Record<string, number>;
  history: HistoryEntry[];
  status: Record<string, { ok: boolean; at: number }>;
  settings: Settings;
  meta: Meta;
  toasts: Toast[];
  jobs: ImportJob[];
  query: string;
  currentChannelId: string | null;
  online: boolean;

  init: () => Promise<void>;
  toast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: string) => void;
  setQuery: (q: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  setMeta: (p: Partial<Meta>) => void;
  toggleFavorite: (id: string) => void;
  play: (id: string) => void;
  recordPlay: (id: string) => void;
  markStatus: (id: string, ok: boolean) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => Promise<void>;
  importMany: (inputs: ImportInput[]) => Promise<void>;
  importDemo: () => Promise<void>;
  dismissJob: (id: string) => void;
  clearJobs: () => void;
  updateList: (id: string, file?: File) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  toggleList: (id: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  exportBackup: (kind: BackupFile["kind"]) => Promise<void>;
  importBackup: (file: File, replace: boolean) => Promise<RestoreSummary | null>;
  deleteAllData: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const safe = (p: Promise<unknown>) => p.catch(() => undefined);

export const useStore = create<State>((set, get) => {
  const patchPlaylist = (p: Playlist) =>
    set((s) => ({ playlists: s.playlists.map((x) => (x.id === p.id ? p : x)) }));

  const loadPlaylistChannels = async (playlistId: string) => {
    const fresh = (await getChannelsByPlaylist(playlistId)).map(index);
    set((s) => {
      const channels = s.channels.filter((c) => c.playlistId !== playlistId).concat(fresh);
      return { channels, channelMap: new Map(channels.map((c) => [c.id, c])) };
    });
  };

  const updateJob = (id: string, patch: Partial<ImportJob>) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));

  const loadAll = async () => {
    const [playlists, rawChannels, favs, history, statuses, settings, meta] = await Promise.all([
      getPlaylists(),
      getAllChannels(),
      getFavorites(),
      getHistory(),
      getStatuses(),
      getKv<Settings>("settings", DEFAULT_SETTINGS),
      getKv<Meta>("meta", DEFAULT_META),
    ]);
    const channels = rawChannels.map(index);
    channels.sort((a, b) => (a.playlistId === b.playlistId ? a.order - b.order : 0));
    set({
      playlists: playlists.sort((a, b) => a.importedAt - b.importedAt),
      channels,
      channelMap: new Map(channels.map((c) => [c.id, c])),
      favorites: Object.fromEntries(favs.map((f) => [f.id, f.addedAt])),
      history: history.sort((a, b) => b.playedAt - a.playedAt),
      status: Object.fromEntries(statuses.map((s) => [s.id, { ok: s.ok, at: s.at }])),
      settings: { ...DEFAULT_SETTINGS, ...settings },
      meta: { ...DEFAULT_META, ...meta },
      currentChannelId: get().currentChannelId ?? meta.lastChannelId ?? null,
    });
  };

  return {
    ready: false,
    fatalError: null,
    playlists: [],
    channels: [],
    channelMap: new Map(),
    favorites: {},
    history: [],
    status: {},
    settings: DEFAULT_SETTINGS,
    meta: DEFAULT_META,
    toasts: [],
    jobs: [],
    query: "",
    currentChannelId: null,
    online: typeof navigator === "undefined" ? true : navigator.onLine,

    async init() {
      try {
        await loadAll();
        set({ ready: true });
        // Solicita almacenamiento persistente para evitar desalojos por el navegador
        safe(navigator.storage?.persist?.() ?? Promise.resolve());
      } catch (e) {
        set({ fatalError: describeDbError(e), ready: true });
      }
      window.addEventListener("online", () => set({ online: true }));
      window.addEventListener("offline", () => set({ online: false }));
    },

    reloadAll: loadAll,

    toast(kind, message) {
      const id = uid();
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }));
      setTimeout(() => get().dismissToast(id), kind === "error" ? 8000 : 4500);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    setQuery: (query) => set({ query }),

    setSettings(p) {
      const settings = { ...get().settings, ...p };
      set({ settings });
      safe(setKv("settings", settings));
    },
    setMeta(p) {
      const meta = { ...get().meta, ...p };
      set({ meta });
      safe(setKv("meta", meta));
    },

    toggleFavorite(id) {
      const favorites = { ...get().favorites };
      if (favorites[id]) {
        delete favorites[id];
        safe(deleteOne("favorites", id));
        set({ favorites });
      } else {
        const addedAt = Date.now();
        favorites[id] = addedAt;
        safe(putOne("favorites", { id, addedAt }));
        set({ favorites });
        get().toast("success", "Añadido a favoritos");
      }
    },

    play(id) {
      set({ currentChannelId: id });
      get().setMeta({ lastChannelId: id });
      navigate("/watch");
    },

    recordPlay(id) {
      const ch = get().channelMap.get(id);
      if (!ch) return;
      const now = Date.now();
      const prev = get().history.find((h) => h.id === id);
      const entry: HistoryEntry = {
        id,
        name: ch.name,
        logo: ch.logo,
        playedAt: now,
        count: prev ? (now - prev.playedAt < 30_000 ? prev.count : prev.count + 1) : 1,
      };
      let history = [entry, ...get().history.filter((h) => h.id !== id)];
      if (history.length > HISTORY_LIMIT) {
        for (const old of history.slice(HISTORY_LIMIT)) safe(deleteOne("history", old.id));
        history = history.slice(0, HISTORY_LIMIT);
      }
      set({ history });
      safe(putOne("history", entry));
    },

    markStatus(id, ok) {
      const cur = get().status[id];
      if (cur && cur.ok === ok && Date.now() - cur.at < 60_000) return;
      const at = Date.now();
      set((s) => ({ status: { ...s.status, [id]: { ok, at } } }));
      safe(putOne("status", { id, ok, at }));
    },

    removeHistory(id) {
      set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
      safe(deleteOne("history", id));
    },

    async clearHistory() {
      set({ history: [] });
      await safe(clearStore("history"));
      get().toast("success", "Historial limpiado");
    },

    async importMany(inputs) {
      if (!inputs.length) return;
      const jobs: { job: ImportJob; input: ImportInput }[] = inputs.map((input) => ({
        input,
        job: {
          id: uid(),
          label: input.kind === "url" ? input.url : input.file.name,
          stage: "reading",
          progress: 0,
          message: "En cola…",
        },
      }));
      set((s) => ({ jobs: [...jobs.map((j) => j.job), ...s.jobs].slice(0, 20) }));

      const queue = [...jobs];
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const { job, input } = item;
          const outcome = await importSource(input, get().playlists, (stage, progress, message) =>
            updateJob(job.id, { stage, progress, message }),
          );
          if (outcome.status === "imported" && outcome.playlist) {
            set((s) => ({ playlists: [...s.playlists, outcome.playlist!] }));
            await loadPlaylistChannels(outcome.playlist.id);
            updateJob(job.id, { stage: "done", progress: 1, message: outcome.message, channels: outcome.channels });
            get().setMeta({ firstRunDone: true });
          } else if (outcome.status === "duplicate") {
            updateJob(job.id, { stage: "duplicate", progress: 1, message: outcome.message });
          } else {
            updateJob(job.id, { stage: "error", progress: 1, message: outcome.message });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
      const done = get().jobs.filter((j) => jobs.some((x) => x.job.id === j.id));
      const ok = done.filter((j) => j.stage === "done").length;
      const bad = done.filter((j) => j.stage === "error").length;
      if (ok) get().toast("success", ok === 1 ? "Lista importada correctamente" : `${ok} listas importadas`);
      if (bad) get().toast("error", bad === 1 ? "No se pudo importar una lista" : `${bad} listas con errores`);
    },

    async importDemo() {
      const outcome = await importFromText(
        { text: DEMO_M3U, name: "Demostración HLS", sourceType: "file", source: "demo.m3u" },
        get().playlists,
      );
      if (outcome.status === "imported" && outcome.playlist) {
        set((s) => ({ playlists: [...s.playlists, outcome.playlist!] }));
        await loadPlaylistChannels(outcome.playlist.id);
        get().toast("success", "Lista de demostración añadida");
      } else {
        get().toast(outcome.status === "duplicate" ? "info" : "error", outcome.message);
      }
    },

    dismissJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
    clearJobs: () => set((s) => ({ jobs: s.jobs.filter((j) => j.stage !== "done" && j.stage !== "error" && j.stage !== "duplicate") })),

    async updateList(id, file) {
      const p = get().playlists.find((x) => x.id === id);
      if (!p) return;
      const jobId = uid();
      set((s) => ({
        jobs: [{ id: jobId, label: `Actualizando ${p.name}`, stage: "reading", progress: 0, message: "Iniciando…" } as ImportJob, ...s.jobs].slice(0, 20),
      }));
      const res = await updatePlaylist(p, file, (stage, progress, message) => updateJob(jobId, { stage, progress, message }));
      if (res.playlist) patchPlaylist(res.playlist);
      if (res.ok) {
        await loadPlaylistChannels(id);
        updateJob(jobId, { stage: "done", progress: 1, message: res.message });
        get().toast("success", res.message);
      } else {
        updateJob(jobId, { stage: "error", progress: 1, message: res.message });
        get().toast("error", res.message);
      }
    },

    async renameList(id, name) {
      const p = get().playlists.find((x) => x.id === id);
      if (!p) return;
      patchPlaylist(await renamePlaylist(p, name));
    },

    async toggleList(id) {
      const p = get().playlists.find((x) => x.id === id);
      if (!p) return;
      patchPlaylist(await setPlaylistEnabled(p, !p.enabled));
    },

    async deleteList(id) {
      const p = get().playlists.find((x) => x.id === id);
      try {
        await removePlaylist(id);
      } catch (e) {
        get().toast("error", describeDbError(e));
        return;
      }
      const prefix = id + ":";
      set((s) => {
        const channels = s.channels.filter((c) => c.playlistId !== id);
        const favorites = Object.fromEntries(Object.entries(s.favorites).filter(([k]) => !k.startsWith(prefix)));
        const meta = s.meta.activePlaylist === id ? { ...s.meta, activePlaylist: "all" } : s.meta;
        return {
          playlists: s.playlists.filter((x) => x.id !== id),
          channels,
          channelMap: new Map(channels.map((c) => [c.id, c])),
          favorites,
          history: s.history.filter((h) => !h.id.startsWith(prefix)),
          status: Object.fromEntries(Object.entries(s.status).filter(([k]) => !k.startsWith(prefix))),
          meta,
          currentChannelId: s.currentChannelId?.startsWith(prefix) ? null : s.currentChannelId,
        };
      });
      safe(setKv("meta", get().meta));
      get().toast("success", `Lista «${p?.name ?? ""}» eliminada`);
    },

    async exportBackup(kind) {
      try {
        const data = await buildBackup(kind);
        const d = new Date().toISOString().slice(0, 10);
        downloadJson(`nexa-iptv-${kind}-${d}.json`, data);
        get().toast("success", "Copia de seguridad exportada");
      } catch (e) {
        get().toast("error", describeDbError(e));
      }
    },

    async importBackup(file, replace) {
      try {
        if (file.size > 400 * 1024 * 1024) throw new BackupError("El archivo es demasiado grande.");
        let raw: unknown;
        try {
          raw = JSON.parse(await file.text());
        } catch {
          throw new BackupError("El archivo no es un JSON válido.");
        }
        const backup = parseBackup(raw);
        const summary = await restoreBackup(backup, replace);
        await loadAll();
        get().toast(
          "success",
          `Restaurado: ${summary.playlists} listas, ${summary.favorites} favoritos, ${summary.history} reproducciones.`,
        );
        return summary;
      } catch (e) {
        get().toast("error", e instanceof BackupError ? e.message : describeDbError(e));
        return null;
      }
    },

    async deleteAllData() {
      await wipeAll();
      set({
        playlists: [],
        channels: [],
        channelMap: new Map(),
        favorites: {},
        history: [],
        status: {},
        settings: DEFAULT_SETTINGS,
        meta: DEFAULT_META,
        currentChannelId: null,
        jobs: [],
        query: "",
      });
      get().toast("success", "Todos los datos han sido eliminados");
      navigate("/");
    },
  };
});

// ---------- Selectores derivados ----------

/** Canales visibles: listas activas + selector de lista + opción de ocultar duplicados */
export function useVisibleChannels(): IndexedChannel[] {
  const channels = useStore((s) => s.channels);
  const playlists = useStore((s) => s.playlists);
  const active = useStore((s) => s.meta.activePlaylist);
  const hideDup = useStore((s) => s.settings.hideDuplicates);
  return useMemo(() => {
    const enabled = new Set(playlists.filter((p) => p.enabled).map((p) => p.id));
    let list = channels.filter((c) => enabled.has(c.playlistId) && (active === "all" || c.playlistId === active));
    if (hideDup) {
      const seen = new Set<string>();
      list = list.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
    }
    return list;
  }, [channels, playlists, active, hideDup]);
}

export function usePlaylistNames(): Map<string, string> {
  const playlists = useStore((s) => s.playlists);
  return useMemo(() => new Map(playlists.map((p) => [p.id, p.name])), [playlists]);
}
