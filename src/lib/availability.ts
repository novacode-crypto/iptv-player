/**
 * Comprobación de disponibilidad de streams.
 *
 * Cada canal se verifica igual que lo haría el reproductor: peticiones HTTP
 * desde el propio navegador. Para HLS se recorre la lista y, si procede,
 * su variante y el primer segmento, de modo que "disponible" significa que
 * el canal realmente se puede reproducir desde NEXA IPTV (si el servidor no
 * permite CORS, el reproductor tampoco podría verlo).
 */
import type { Channel } from "./types";

export interface ProbeResult {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  /** "ok" o una explicación legible del fallo */
  reason: string;
  ms: number;
}

export interface ProbeRun {
  results: ProbeResult[];
  cancelled: boolean;
}

export interface ProbeOptions {
  /** Tiempo total por canal (ms). Por defecto 9 s. */
  timeoutMs?: number;
  /** Comprobaciones simultáneas. Por defecto 6. */
  concurrency?: number;
  /** Señal para detener la comprobación. */
  signal?: AbortSignal;
  /** Se llama al terminar cada canal. */
  onResult?: (r: ProbeResult) => void;
}

const PLAYLIST_RE = /\.(m3u8?)(\?|#|$)/i;
const MAX_HOPS = 4; // canal → master → variante → segmento

function isMixedContent(url: string): boolean {
  return typeof location !== "undefined" && location.protocol === "https:" && url.startsWith("http:");
}

function httpReason(code: number): string {
  if (code === 401 || code === 403) return `HTTP ${code} · acceso denegado`;
  if (code === 404 || code === 410) return `HTTP ${code} · el canal ya no existe`;
  if (code >= 500) return `HTTP ${code} · error del servidor`;
  return `HTTP ${code}`;
}

function networkReason(url: string, e: unknown): string {
  const name = (e as DOMException | undefined)?.name;
  if (name === "AbortError") return "Sin respuesta (tiempo agotado)";
  if (isMixedContent(url)) return "Bloqueado por el navegador (mezcla HTTP/HTTPS)";
  return "Sin acceso desde el navegador (CORS o servidor caído)";
}

/** Primera URI no etiquetada de una lista M3U, resuelta respecto a la base */
function firstUri(body: string, base: string): string | null {
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      return new URL(line, base).toString();
    } catch {
      return null;
    }
  }
  return null;
}

interface Step {
  status: number;
  type: string;
  text?: string;
  cancelled: boolean;
}

/** Un paso HTTP con presupuesto de tiempo compartido y reenvío de la cancelación */
async function fetchStep(url: string, deadline: number, outer: AbortSignal): Promise<Step> {
  const ctrl = new AbortController();
  const relay = () => ctrl.abort();
  if (outer.aborted) relay();
  else outer.addEventListener("abort", relay, { once: true });
  const timer = setTimeout(() => ctrl.abort(), Math.max(0, deadline - Date.now()));
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "follow",
    });
    const type = res.headers?.get?.("content-type") ?? "";
    let text: string | undefined;
    const wantsBody = PLAYLIST_RE.test(url) || /mpegurl/i.test(type);
    if (wantsBody && res.ok) {
      try {
        text = await res.text(); // las listas son pequeñas; el temporizador acota la lectura
      } catch {
        /* cuerpo cortado por el presupuesto de tiempo */
      }
    } else {
      try {
        ctrl.abort(); // descarta el cuerpo del stream tras leer las cabeceras
      } catch {
        /* noop */
      }
    }
    return { status: res.status ?? 0, type, text, cancelled: false };
  } catch (e) {
    if (outer.aborted) return { status: 0, type: "", cancelled: true };
    throw e;
  } finally {
    clearTimeout(timer);
    outer.removeEventListener("abort", relay);
  }
}

/** Razón del veredicto para una URL del árbol del canal */
async function probeUrl(url: string, deadline: number, outer: AbortSignal, depth: number): Promise<string> {
  if (outer.aborted) return "cancelado";
  if (depth > MAX_HOPS) return "ok";
  let step: Step;
  try {
    step = await fetchStep(url, deadline, outer);
  } catch (e) {
    return networkReason(url, e);
  }
  if (step.cancelled) return "cancelado";
  if (step.status !== 0 && (step.status < 200 || step.status >= 300)) return httpReason(step.status);

  if (step.text !== undefined) {
    const body = step.text.trim();
    if (!body.includes("#EXTM3U")) return "No es una lista HLS válida";
    if (body.includes("#EXT-X-STREAM-INF")) {
      const variant = firstUri(body, url);
      if (!variant) return "Lista HLS sin variantes";
      return await probeUrl(variant, deadline, outer, depth + 1);
    }
    const seg = firstUri(body, url);
    if (!seg) return "Lista HLS vacía";
    return await probeUrl(seg, deadline, outer, depth + 1);
  }
  return "ok";
}

async function probeChannel(ch: Channel, timeoutMs: number, signal: AbortSignal): Promise<ProbeResult> {
  const start = Date.now();
  const reason = await probeUrl(ch.url, start + timeoutMs, signal, 0);
  return { id: ch.id, name: ch.name, url: ch.url, ok: reason === "ok", reason, ms: Date.now() - start };
}

/** Comprueba una lista de canales con un pequeño pool de peticiones */
export async function probeMany(channels: Channel[], opts: ProbeOptions = {}): Promise<ProbeRun> {
  const timeoutMs = opts.timeoutMs ?? 9000;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 6, 12));
  const signal = opts.signal ?? new AbortController().signal;
  const results: ProbeResult[] = [];
  const queue = [...channels];

  const worker = async () => {
    for (;;) {
      if (signal.aborted) return;
      const ch = queue.shift();
      if (!ch) return;
      const r = await probeChannel(ch, timeoutMs, signal);
      results.push(r);
      opts.onResult?.(r);
      if (signal.aborted) return;
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) || 1 }, worker));
  return { results, cancelled: signal.aborted && queue.length > 0 };
}
