import { parseM3U, type ParseResult } from "./m3u";
// `?worker&inline` empaqueta el worker dentro del bundle (sin CDN ni archivos externos)
import M3UWorker from "./m3u.worker?worker&inline";

/**
 * Analiza una lista M3U fuera del hilo principal (Web Worker).
 * Si el entorno no soporta workers, cae al análisis en el hilo principal.
 */
export function parseAsync(
  text: string,
  playlistId: string,
  baseUrl: string | undefined,
  onProgress?: (fraction: number) => void,
): Promise<ParseResult> {
  const fallback = () => parseM3U(text, { playlistId, baseUrl, onProgress });

  if (typeof Worker === "undefined") return Promise.resolve(fallback());

  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new M3UWorker();
    } catch {
      resolve(fallback());
      return;
    }
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress") onProgress?.(msg.value);
      else if (msg.type === "done") {
        worker.terminate();
        resolve(msg.result as ParseResult);
      } else if (msg.type === "error") {
        worker.terminate();
        resolve(fallback());
      }
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(fallback());
    };
    worker.postMessage({ text, playlistId, baseUrl });
  });
}
