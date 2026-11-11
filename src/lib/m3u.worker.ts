/// <reference lib="webworker" />
import { parseM3U } from "./m3u";

export interface WorkerRequest {
  text: string;
  playlistId: string;
  baseUrl?: string;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const { text, playlistId, baseUrl } = e.data;
    const result = parseM3U(text, {
      playlistId,
      baseUrl,
      onProgress: (p) => self.postMessage({ type: "progress", value: p }),
    });
    self.postMessage({ type: "done", result });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
