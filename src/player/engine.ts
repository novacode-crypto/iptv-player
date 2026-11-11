import Hls from "hls.js";
import type { QualityPref } from "@/lib/types";

export type EngineKind = "hls" | "mpegts" | "native";
export type StreamType = "hls" | "ts" | "flv" | "native" | "dash" | "unsupported" | "unknown";

export interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export interface PlaybackError {
  message: string;
  kind: "network" | "media" | "unsupported" | "other";
}

export interface EngineHandlers {
  onEngine: (kind: EngineKind) => void;
  onLevels: (levels: QualityLevel[]) => void;
  /** índice del nivel activo (-1 si desconocido) */
  onLevel: (index: number, auto: boolean) => void;
  onLive: (live: boolean) => void;
  /** El flujo está listo para reproducirse */
  onReady: () => void;
  onError: (e: PlaybackError) => void;
}

const NATIVE_EXT = /\.(mp4|m4v|webm|ogg|ogv|mp3|aac|m4a|mov|wav|opus|mkv)$/;

export function detectStream(url: string): { type: StreamType; reason?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { type: "unsupported", reason: "La URL del canal no es válida." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    const proto = u.protocol.replace(":", "").toUpperCase();
    return {
      type: "unsupported",
      reason: `El protocolo ${proto} no puede reproducirse en un navegador web. Solo se admiten flujos HTTP/HTTPS (HLS, MPEG-TS, MP4…).`,
    };
  }
  const path = u.pathname.toLowerCase();
  if (path.endsWith(".mpd")) {
    return { type: "dash", reason: "El formato MPEG-DASH (.mpd) no está incluido en esta versión de NEXA IPTV." };
  }
  if (path.endsWith(".m3u8") || path.endsWith(".m3u") || /m3u8/i.test(u.search)) return { type: "hls" };
  if (/\.(ts|m2ts|mts)$/.test(path)) return { type: "ts" };
  if (path.endsWith(".flv")) return { type: "flv" };
  if (NATIVE_EXT.test(path)) return { type: "native" };
  return { type: "unknown" };
}

function describeHttp(code?: number): string | null {
  if (!code) return null;
  if (code === 401 || code === 403) return `Acceso denegado por el servidor (HTTP ${code}). La fuente puede requerir autorización o bloquear este origen.`;
  if (code === 404 || code === 410) return `El canal ya no está disponible en el servidor (HTTP ${code}).`;
  if (code >= 500) return `El servidor del canal tiene un problema (HTTP ${code}).`;
  return `El servidor respondió con el error HTTP ${code}.`;
}

function networkMessage(url: string, code?: number): string {
  const http = describeHttp(code);
  if (http) return http;
  const mixed = location.protocol === "https:" && url.startsWith("http:");
  if (mixed) {
    return "El navegador bloquea este canal porque usa HTTP dentro de una página HTTPS (contenido mixto). Abre NEXA IPTV desde http://localhost o usa una fuente HTTPS.";
  }
  return "No se pudo conectar con el flujo: el canal está caído, la URL no responde o el servidor no permite el acceso desde el navegador (CORS).";
}

export class PlaybackEngine {
  private video: HTMLVideoElement;
  private h: EngineHandlers;
  private hls: Hls | null = null;
  private ts: import("mpegts.js").default.Player | null = null;
  private nativeCleanup: (() => void) | null = null;
  private candidates: EngineKind[] = [];
  private url = "";
  private token = 0;
  private pref: QualityPref = "auto";
  private mediaRecoveries = 0;
  private levels: QualityLevel[] = [];

  constructor(video: HTMLVideoElement, handlers: EngineHandlers) {
    this.video = video;
    this.h = handlers;
  }

  load(url: string, pref: QualityPref) {
    this.dispose();
    this.url = url;
    this.pref = pref;
    this.mediaRecoveries = 0;
    this.levels = [];
    this.h.onLevels([]);
    const token = ++this.token;

    const { type, reason } = detectStream(url);
    if (type === "unsupported" || type === "dash") {
      this.h.onError({ kind: "unsupported", message: reason ?? "Formato no soportado." });
      return;
    }
    this.candidates =
      type === "hls"
        ? ["hls", "native"]
        : type === "ts" || type === "flv"
          ? ["mpegts"]
          : type === "native"
            ? ["native"]
            : ["hls", "mpegts", "native"];
    void this.next(token);
  }

  setLevel(index: number) {
    if (!this.hls) return;
    this.hls.currentLevel = index;
    this.h.onLevel(index === -1 ? this.hls.currentLevel : index, index === -1);
  }

  dispose() {
    this.token++;
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.ts) {
      try {
        this.ts.pause();
        this.ts.unload();
        this.ts.detachMediaElement();
        this.ts.destroy();
      } catch {
        /* noop */
      }
      this.ts = null;
    }
    this.nativeCleanup?.();
    this.nativeCleanup = null;
    try {
      this.video.removeAttribute("src");
      this.video.load();
    } catch {
      /* noop */
    }
  }

  // ---- internos ----
  private async next(token: number, lastMessage?: PlaybackError) {
    if (token !== this.token) return;
    const kind = this.candidates.shift();
    if (!kind) {
      this.h.onError(
        lastMessage ?? { kind: "unsupported", message: "Este navegador no dispone de un motor compatible para este formato." },
      );
      return;
    }
    if (kind === "hls") this.startHls(token);
    else if (kind === "mpegts") await this.startMpegts(token);
    else this.startNative(token);
  }

  private startHls(token: number) {
    if (!Hls.isSupported()) {
      void this.next(token, {
        kind: "unsupported",
        message: "Este navegador no soporta HLS mediante Media Source Extensions.",
      });
      return;
    }
    this.h.onEngine("hls");
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 30,
      backBufferLength: 30,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 4,
    });
    this.hls = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      if (token !== this.token) return;
      this.levels = data.levels.map((l, i) => ({
        index: i,
        height: l.height || 0,
        bitrate: l.bitrate || 0,
        label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)} kbps`,
      }));
      this.h.onLevels(this.levels);
      this.applyPreferred(hls);
      this.h.onReady();
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      if (token === this.token) this.h.onLevel(data.level, hls.autoLevelEnabled);
    });
    hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
      if (token === this.token) this.h.onLive(!!data.details.live);
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (token !== this.token || !data.fatal) return;
      if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR && this.candidates.length) {
        hls.destroy();
        this.hls = null;
        void this.next(token);
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && this.mediaRecoveries < 2) {
        this.mediaRecoveries++;
        hls.recoverMediaError();
        return;
      }
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        this.h.onError({ kind: "network", message: networkMessage(this.url, data.response?.code) });
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        this.h.onError({ kind: "media", message: "El navegador no puede decodificar este flujo (códec o formato no compatible)." });
      } else {
        this.h.onError({ kind: "other", message: `Error de reproducción HLS (${data.details}).` });
      }
    });

    hls.attachMedia(this.video);
    hls.loadSource(this.url);
  }

  private applyPreferred(hls: Hls) {
    const pref = this.pref;
    if (pref === "auto" || !this.levels.length) return;
    const byHeight = [...this.levels].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
    let target = byHeight[0];
    if (pref !== "highest") {
      const max = Number(pref);
      target = byHeight.find((l) => l.height > 0 && l.height <= max) ?? byHeight[byHeight.length - 1];
    }
    hls.currentLevel = target.index;
    this.h.onLevel(target.index, false);
  }

  private async startMpegts(token: number) {
    let mpegts: typeof import("mpegts.js").default;
    try {
      mpegts = (await import("mpegts.js")).default;
    } catch {
      void this.next(token, { kind: "unsupported", message: "No se pudo cargar el motor MPEG-TS." });
      return;
    }
    if (token !== this.token) return;
    if (!mpegts.isSupported()) {
      void this.next(token, { kind: "unsupported", message: "Este navegador no soporta MPEG-TS mediante Media Source Extensions." });
      return;
    }
    this.h.onEngine("mpegts");
    const isFlv = /\.flv$/i.test(new URL(this.url).pathname);
    const player = mpegts.createPlayer(
      { type: isFlv ? "flv" : "mpegts", isLive: true, url: this.url },
      {
        enableWorker: true,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 8,
        liveBufferLatencyMinRemain: 1,
        lazyLoad: false,
      },
    );
    this.ts = player;
    player.on(mpegts.Events.ERROR, (type: string, detail: string, info?: { code?: number; msg?: string }) => {
      if (token !== this.token) return;
      const err: PlaybackError =
        type === mpegts.ErrorTypes.NETWORK_ERROR
          ? { kind: "network", message: networkMessage(this.url, info?.code && info.code >= 400 ? info.code : undefined) }
          : type === mpegts.ErrorTypes.MEDIA_ERROR
            ? { kind: "media", message: "El navegador no puede decodificar este flujo (códec o formato no compatible)." }
            : { kind: "other", message: `Error de reproducción MPEG-TS (${detail}).` };
      if (this.candidates.length) {
        try {
          player.destroy();
        } catch {
          /* noop */
        }
        this.ts = null;
        void this.next(token, err);
      } else {
        this.h.onError(err);
      }
    });
    player.attachMediaElement(this.video);
    player.load();
    this.h.onLive(true);
    this.h.onReady();
  }

  private startNative(token: number) {
    const v = this.video;
    const mime = this.url.toLowerCase().includes("m3u8") ? "application/vnd.apple.mpegurl" : "";
    if (mime && !v.canPlayType(mime)) {
      void this.next(token, { kind: "unsupported", message: "Este navegador no puede reproducir HLS de forma nativa ni mediante hls.js." });
      return;
    }
    this.h.onEngine("native");
    const onError = () => {
      if (token !== this.token) return;
      const code = v.error?.code;
      const err: PlaybackError =
        code === 2
          ? { kind: "network", message: networkMessage(this.url) }
          : code === 3
            ? { kind: "media", message: "El flujo está dañado o no se puede decodificar." }
            : { kind: "unsupported", message: "El navegador no reconoce este formato de vídeo. Puede requerir un motor adicional." };
      this.h.onError(err);
    };
    const onMeta = () => {
      if (token !== this.token) return;
      this.h.onLive(v.duration === Infinity);
    };
    v.addEventListener("error", onError);
    v.addEventListener("loadedmetadata", onMeta);
    this.nativeCleanup = () => {
      v.removeEventListener("error", onError);
      v.removeEventListener("loadedmetadata", onMeta);
    };
    v.src = this.url;
    v.load();
    this.h.onReady();
  }
}
