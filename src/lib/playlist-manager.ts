import {
  deletePlaylistCascade,
  describeDbError,
  getChannelsByPlaylist,
  putOne,
  replacePlaylistChannels,
} from "./db";
import { parseAsync } from "./parse-async";
import type { Channel, Playlist } from "./types";
import { hash64, isHttpUrl, uid } from "./utils";
import { categorize } from "./categories";

export const MAX_BYTES = 150 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

export type Stage = "reading" | "parsing" | "saving";
export type StageCallback = (stage: Stage, progress: number, message: string) => void;

export type ImportInput =
  | { kind: "url"; url: string; name?: string }
  | { kind: "file"; file: File; name?: string };

export interface ImportOutcome {
  status: "imported" | "duplicate" | "error";
  message: string;
  playlist?: Playlist;
  channels?: number;
  duplicatesRemoved?: number;
}

export class ImportError extends Error {}

const normUrl = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();

export function validateUrl(url: string): string | null {
  const v = url.trim();
  if (!v) return "Introduce una URL.";
  if (!isHttpUrl(v)) return "La URL debe empezar por http:// o https://";
  return null;
}

export async function fetchText(
  url: string,
  onProgress?: (fraction: number, bytes: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: "omit", cache: "no-store" });
    if (!res.ok) throw new ImportError(`El servidor respondió con el error HTTP ${res.status}.`);
    const total = Number(res.headers.get("content-length")) || 0;
    if (total > MAX_BYTES) throw new ImportError("La lista supera el tamaño máximo permitido (150 MB).");

    if (!res.body) return await res.text();
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (received > MAX_BYTES) {
        ctrl.abort();
        throw new ImportError("La lista supera el tamaño máximo permitido (150 MB).");
      }
      onProgress?.(total ? received / total : 0, received);
    }
    const buf = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.length;
    }
    return new TextDecoder("utf-8").decode(buf);
  } catch (e) {
    if (e instanceof ImportError) throw e;
    if ((e as Error)?.name === "AbortError") {
      throw new ImportError("Tiempo de espera agotado o descarga cancelada.");
    }
    const mixed = location.protocol === "https:" && url.startsWith("http:");
    throw new ImportError(
      mixed
        ? "El navegador bloquea contenido HTTP desde una página HTTPS. Usa una URL https:// o descarga la lista y súbela como archivo local."
        : "No se pudo descargar la lista. Puede deberse a una restricción CORS del servidor, a que la URL no existe o a falta de conexión. Descarga el archivo y usa «Archivo local».",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function defaultNameFor(input: { kind: "url"; url: string } | { kind: "file"; name: string }): string {
  if (input.kind === "file") return input.name.replace(/\.(m3u8?|txt)$/i, "") || "Lista local";
  try {
    const u = new URL(input.url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const base = seg.replace(/\.(m3u8?|txt)$/i, "");
    return base ? `${u.hostname} · ${base}`.slice(0, 80) : u.hostname;
  } catch {
    return "Lista IPTV";
  }
}

interface TextImport {
  text: string;
  name: string;
  sourceType: "url" | "file";
  source: string;
  baseUrl?: string;
}

/** Núcleo de importación: analiza, detecta duplicados y guarda una copia local. */
export async function importFromText(
  t: TextImport,
  existing: Playlist[],
  onStage?: StageCallback,
): Promise<ImportOutcome> {
  const id = uid();
  onStage?.("parsing", 0, "Analizando canales…");
  const parsed = await parseAsync(t.text, id, t.baseUrl, (p) => onStage?.("parsing", p, "Analizando canales…"));

  let channels: Channel[] = parsed.channels;
  if (parsed.kind === "hls-manifest") {
    if (t.sourceType !== "url") {
      return {
        status: "error",
        message: "El archivo es un manifiesto HLS de un único flujo, no una lista de canales. Añade su URL para crear un canal.",
      };
    }
    channels = [
      {
        id: `${id}:${hash64(t.source)}`,
        playlistId: id,
        name: t.name,
        altName: "",
        tvgId: "",
        logo: "",
        group: "",
        category: categorize(""),
        language: "",
        country: "",
        url: t.source,
        order: 0,
      },
    ];
  } else if (parsed.kind === "invalid") {
    return {
      status: "error",
      message:
        "El contenido no es una lista M3U válida (no se encontró #EXTM3U ni canales con URL reproducible).",
    };
  }

  const contentHash = hash64(channels.map((c) => c.url).join("\n"));
  const dupContent = existing.find((p) => p.contentHash === contentHash);
  if (dupContent) {
    return {
      status: "duplicate",
      message: `Esta lista contiene exactamente los mismos canales que «${dupContent.name}». No se importó de nuevo.`,
      playlist: dupContent,
    };
  }

  const now = Date.now();
  const playlist: Playlist = {
    id,
    name: t.name,
    sourceType: t.sourceType,
    source: t.source,
    enabled: true,
    importedAt: now,
    updatedAt: now,
    channelCount: channels.length,
    contentHash,
    duplicatesRemoved: parsed.duplicatesRemoved,
  };

  onStage?.("saving", 0.5, `Guardando ${channels.length.toLocaleString("es-ES")} canales…`);
  try {
    await replacePlaylistChannels(id, channels, playlist);
  } catch (e) {
    return { status: "error", message: describeDbError(e) };
  }

  const dups = parsed.duplicatesRemoved ? ` ${parsed.duplicatesRemoved} entradas duplicadas omitidas.` : "";
  return {
    status: "imported",
    playlist,
    channels: channels.length,
    duplicatesRemoved: parsed.duplicatesRemoved,
    message: `${channels.length.toLocaleString("es-ES")} canales importados.${dups}`,
  };
}

/** Importa una fuente (URL o archivo) y devuelve el resultado sin lanzar. */
export async function importSource(
  input: ImportInput,
  existing: Playlist[],
  onStage?: StageCallback,
): Promise<ImportOutcome> {
  try {
    if (input.kind === "url") {
      const err = validateUrl(input.url);
      if (err) return { status: "error", message: err };
      const url = input.url.trim();
      const dup = existing.find((p) => p.sourceType === "url" && normUrl(p.source) === normUrl(url));
      if (dup) {
        return {
          status: "duplicate",
          message: `Esta URL ya está importada como «${dup.name}». Usa «Actualizar» para refrescarla.`,
          playlist: dup,
        };
      }
      onStage?.("reading", 0, "Descargando lista…");
      const text = await fetchText(url, (f, b) =>
        onStage?.("reading", f, `Descargando… ${(b / 1024 / 1024).toFixed(1)} MB`),
      );
      return await importFromText(
        {
          text,
          name: input.name?.trim() || defaultNameFor({ kind: "url", url }),
          sourceType: "url",
          source: url,
          baseUrl: url,
        },
        existing,
        onStage,
      );
    }

    const { file } = input;
    if (file.size === 0) return { status: "error", message: "El archivo está vacío." };
    if (file.size > MAX_BYTES) return { status: "error", message: "El archivo supera el tamaño máximo permitido (150 MB)." };
    onStage?.("reading", 0.3, "Leyendo archivo…");
    const text = await file.text();
    return await importFromText(
      {
        text,
        name: input.name?.trim() || defaultNameFor({ kind: "file", name: file.name }),
        sourceType: "file",
        source: file.name,
      },
      existing,
      onStage,
    );
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Error desconocido durante la importación." };
  }
}

export interface UpdateOutcome {
  ok: boolean;
  message: string;
  playlist?: Playlist;
  added?: number;
  removed?: number;
}

/**
 * Actualiza una lista desde su URL (o desde un archivo nuevo). Si falla, conserva
 * intacta la copia local anterior. Los ids de canal son estables, por lo que los
 * favoritos, el historial y el estado de disponibilidad se mantienen.
 */
export async function updatePlaylist(
  playlist: Playlist,
  file?: File,
  onStage?: StageCallback,
): Promise<UpdateOutcome> {
  try {
    let text: string;
    if (file) {
      if (file.size > MAX_BYTES) throw new ImportError("El archivo supera el tamaño máximo permitido (150 MB).");
      onStage?.("reading", 0.3, "Leyendo archivo…");
      text = await file.text();
    } else if (playlist.sourceType === "url") {
      onStage?.("reading", 0, "Descargando lista…");
      text = await fetchText(playlist.source, (f, b) =>
        onStage?.("reading", f, `Descargando… ${(b / 1024 / 1024).toFixed(1)} MB`),
      );
    } else {
      throw new ImportError("Esta lista es local: selecciona un archivo para reemplazarla.");
    }

    onStage?.("parsing", 0, "Analizando canales…");
    const baseUrl = playlist.sourceType === "url" && !file ? playlist.source : undefined;
    const parsed = await parseAsync(text, playlist.id, baseUrl, (p) => onStage?.("parsing", p, "Analizando canales…"));
    let channels = parsed.channels;
    if (parsed.kind === "hls-manifest" && playlist.sourceType === "url") {
      const old = await getChannelsByPlaylist(playlist.id);
      channels = old.length ? old : [];
    } else if (parsed.kind === "invalid") {
      throw new ImportError("El contenido descargado no es una lista M3U válida. Se conserva la copia anterior.");
    }

    const old = await getChannelsByPlaylist(playlist.id);
    const oldIds = new Set(old.map((c) => c.id));
    const newIds = new Set(channels.map((c) => c.id));
    let added = 0;
    for (const id of newIds) if (!oldIds.has(id)) added++;
    let removed = 0;
    for (const id of oldIds) if (!newIds.has(id)) removed++;

    const updated: Playlist = {
      ...playlist,
      source: file ? file.name : playlist.source,
      updatedAt: Date.now(),
      channelCount: channels.length,
      contentHash: hash64(channels.map((c) => c.url).join("\n")),
      duplicatesRemoved: parsed.duplicatesRemoved,
      lastError: undefined,
    };
    onStage?.("saving", 0.5, "Guardando cambios…");
    await replacePlaylistChannels(playlist.id, channels, updated);
    return {
      ok: true,
      playlist: updated,
      added,
      removed,
      message: `Lista actualizada: ${channels.length.toLocaleString("es-ES")} canales (+${added} / −${removed}).`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : describeDbError(e);
    try {
      await putOne("playlists", { ...playlist, lastError: message });
    } catch {
      /* noop */
    }
    return { ok: false, message: `${message} La copia local anterior se ha conservado.`, playlist: { ...playlist, lastError: message } };
  }
}

export async function renamePlaylist(p: Playlist, name: string): Promise<Playlist> {
  const next = { ...p, name: name.trim().slice(0, 80) || p.name };
  await putOne("playlists", next);
  return next;
}

export async function setPlaylistEnabled(p: Playlist, enabled: boolean): Promise<Playlist> {
  const next = { ...p, enabled };
  await putOne("playlists", next);
  return next;
}

export const removePlaylist = (id: string) => deletePlaylistCascade(id);
