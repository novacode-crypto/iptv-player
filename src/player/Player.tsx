import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  BackwardIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  RectangleStackIcon,
  SignalSlashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  TvIcon,
  ViewfinderCircleIcon,
} from "@heroicons/react/24/outline";
import { ChannelLogo } from "@/components/ChannelViews";
import { Spinner } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { AspectMode, Channel, QualityPref } from "@/lib/types";
import { formatClock } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { PlaybackEngine, type EngineKind, type PlaybackError, type QualityLevel } from "./engine";

type Status = "idle" | "loading" | "playing" | "buffering" | "reconnecting" | "error";

const ASPECTS: { value: AspectMode; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "cover", label: "Llenar pantalla" },
  { value: "stretch", label: "Estirar" },
];

const SHORTCUTS: [string, string][] = [
  ["Espacio / K", "Reproducir o pausar"],
  ["M", "Silenciar"],
  ["↑ / ↓", "Volumen"],
  ["← / →", "Retroceder / avanzar 10 s"],
  ["F", "Pantalla completa"],
  ["P", "Imagen en imagen"],
  ["A", "Cambiar relación de aspecto"],
  ["N / B", "Canal siguiente / anterior"],
  ["H", "Mostrar esta ayuda"],
];

const STALL_MS = 25_000;
const START_MS = 35_000;

/** Traduce la elección del selector a la preferencia persistida en ajustes */
function levelToPref(index: number, levels: QualityLevel[]): QualityPref {
  if (index === -1) return "auto";
  const h = levels.find((l) => l.index === index)?.height ?? 0;
  if (h >= 1080) return "1080";
  if (h >= 720) return "720";
  if (h >= 480) return "480";
  return "360";
}

function videoStyle(aspect: AspectMode): React.CSSProperties {
  switch (aspect) {
    case "cover":
      return { objectFit: "cover", width: "100%", height: "100%" };
    case "stretch":
      return { objectFit: "fill", width: "100%", height: "100%" };
    case "16:9":
      return { objectFit: "fill", aspectRatio: "16 / 9", height: "100%", maxWidth: "100%" };
    case "4:3":
      return { objectFit: "fill", aspectRatio: "4 / 3", height: "100%", maxWidth: "100%" };
    default:
      return { objectFit: "contain", width: "100%", height: "100%" };
  }
}

interface Props {
  channel: Channel | null;
  onNext?: () => void;
  onPrev?: () => void;
  className?: string;
}

export function Player({ channel, onNext, onPrev, className }: Props) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const recordPlay = useStore((s) => s.recordPlay);
  const markStatus = useStore((s) => s.markStatus);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<PlaybackError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(settings.volume);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [isLive, setIsLive] = useState(false);
  const [behindLive, setBehindLive] = useState(false);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [level, setLevel] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(true);
  const [engineKind, setEngineKind] = useState<EngineKind | null>(null);
  const [controlsOn, setControlsOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [menu, setMenu] = useState<null | "quality" | "aspect" | "help">(null);
  const [osd, setOsd] = useState("");
  const [blocked, setBlocked] = useState(false);

  // refs para evitar cierres obsoletos dentro de callbacks del motor
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const channelRef = useRef(channel);
  channelRef.current = channel;
  const attemptRef = useRef(0);
  const retryTimer = useRef<number>(0);
  const watchdog = useRef<number>(0);
  const hideTimer = useRef<number>(0);
  const osdTimer = useRef<number>(0);
  const recorded = useRef(false);
  const nextRef = useRef(onNext);
  nextRef.current = onNext;
  const prevRef = useRef(onPrev);
  prevRef.current = onPrev;

  const flash = useCallback((text: string) => {
    setOsd(text);
    window.clearTimeout(osdTimer.current);
    osdTimer.current = window.setTimeout(() => setOsd(""), 1200);
  }, []);

  const clearWatchdog = () => window.clearTimeout(watchdog.current);

  const fatal = useCallback(
    (err: PlaybackError) => {
      clearWatchdog();
      const s = settingsRef.current;
      const ch = channelRef.current;
      if (err.kind !== "unsupported" && s.autoReconnect && attemptRef.current < s.maxRetries && ch) {
        attemptRef.current++;
        setAttempt(attemptRef.current);
        setStatus("reconnecting");
        setError(err);
        window.clearTimeout(retryTimer.current);
        retryTimer.current = window.setTimeout(() => {
          engineRef.current?.load(ch.url, settingsRef.current.preferredQuality);
          watchdog.current = window.setTimeout(
            () => fatal({ kind: "network", message: "El canal no responde (tiempo de espera agotado)." }),
            START_MS,
          );
        }, s.retryDelay * 1000);
      } else {
        setStatus("error");
        setError(err);
        if (ch) markStatus(ch.id, false);
      }
    },
    [markStatus],
  );

  // ---- creación del motor (una vez) ----
  useEffect(() => {
    const video = videoRef.current!;
    video.volume = settingsRef.current.volume;
    video.muted = settingsRef.current.startMuted;
    setMuted(video.muted);

    const engine = new PlaybackEngine(video, {
      onEngine: setEngineKind,
      onLevels: setLevels,
      onLevel: (i, auto) => {
        setLevel(i);
        setAutoLevel(auto);
      },
      onLive: setIsLive,
      onReady: () => {
        const s = settingsRef.current;
        if (s.autoplay || attemptRef.current > 0 || recorded.current) {
          video.play().catch((e: DOMException) => {
            if (e?.name === "NotAllowedError") {
              setBlocked(true);
              setStatus("idle");
              clearWatchdog();
            }
          });
        } else {
          setStatus("idle");
          setBlocked(true);
          clearWatchdog();
        }
      },
      onError: fatal,
    });
    engineRef.current = engine;

    const onPlaying = () => {
      clearWatchdog();
      attemptRef.current = 0;
      setAttempt(0);
      setError(null);
      setBlocked(false);
      setStatus("playing");
      const ch = channelRef.current;
      if (ch) {
        markStatus(ch.id, true);
        if (!recorded.current) {
          recorded.current = true;
          recordPlay(ch.id);
        }
      }
    };
    const onWaiting = () => {
      setStatus((s) => (s === "error" || s === "reconnecting" ? s : "buffering"));
      clearWatchdog();
      watchdog.current = window.setTimeout(
        () => fatal({ kind: "network", message: "El flujo se detuvo y no se recupera. Puede que el canal haya dejado de emitir." }),
        STALL_MS,
      );
    };
    const onTime = () => {
      setTime({ cur: video.currentTime, dur: video.duration });
      if (video.seekable.length) {
        const end = video.seekable.end(video.seekable.length - 1);
        setBehindLive(end - video.currentTime > 20);
      }
    };
    const onVol = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement || (video as unknown as { webkitDisplayingFullscreen?: boolean }).webkitDisplayingFullscreen === true);

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", () => {
      if (!video.paused) clearWatchdog();
    });
    video.addEventListener("pause", () => setPaused(true));
    video.addEventListener("play", () => setPaused(false));
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onTime);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("enterpictureinpicture", () => setPip(true));
    video.addEventListener("leavepictureinpicture", () => setPip(false));
    document.addEventListener("fullscreenchange", onFs);
    video.addEventListener("webkitendfullscreen", onFs);

    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.clearTimeout(retryTimer.current);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(osdTimer.current);
      clearWatchdog();
      engine.dispose();
      engineRef.current = null;
      if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- carga al cambiar de canal ----
  const startLoad = useCallback(() => {
    const ch = channelRef.current;
    const engine = engineRef.current;
    window.clearTimeout(retryTimer.current);
    clearWatchdog();
    if (!ch || !engine) return;
    recorded.current = false;
    attemptRef.current = 0;
    setAttempt(0);
    setError(null);
    setBlocked(false);
    setIsLive(false);
    setBehindLive(false);
    setLevel(-1);
    setAutoLevel(true);
    setTime({ cur: 0, dur: 0 });
    setStatus("loading");
    engine.load(ch.url, settingsRef.current.preferredQuality);
    watchdog.current = window.setTimeout(
      () => fatal({ kind: "network", message: "El canal no responde (tiempo de espera agotado)." }),
      START_MS,
    );
  }, [fatal]);

  useEffect(() => {
    if (channel) startLoad();
    else {
      engineRef.current?.dispose();
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, channel?.url]);

  // ---- acciones ----
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !channelRef.current) return;
    if (v.paused) {
      setBlocked(false);
      v.play().catch(() => undefined);
    } else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current!;
    v.muted = !v.muted;
    flash(v.muted ? "Silenciado" : `Volumen ${Math.round(v.volume * 100)}%`);
  }, [flash]);

  const changeVolume = useCallback(
    (val: number) => {
      const v = videoRef.current!;
      const nv = Math.min(1, Math.max(0, val));
      v.volume = nv;
      v.muted = nv === 0;
      setSettings({ volume: nv || settingsRef.current.volume });
      flash(`Volumen ${Math.round(nv * 100)}%`);
    },
    [flash, setSettings],
  );

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const c = containerRef.current;
    if (!v || !c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    const target = settingsRef.current.fullscreenMode === "video" ? v : c;
    if (target.requestFullscreen) target.requestFullscreen().catch(() => undefined);
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS Safari
  }, []);

  const pipSupported = typeof document !== "undefined" && !!document.pictureInPictureEnabled;
  const togglePip = useCallback(async () => {
    const v = videoRef.current!;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      flash("Imagen en imagen no disponible");
    }
  }, [flash]);

  const seekBy = useCallback(
    (d: number) => {
      const v = videoRef.current!;
      if (!isFinite(v.duration) && !v.seekable.length) return;
      const end = v.seekable.length ? v.seekable.end(v.seekable.length - 1) : v.duration;
      const start = v.seekable.length ? v.seekable.start(0) : 0;
      if (!isFinite(v.duration) && end - start < 30) return;
      v.currentTime = Math.min(end, Math.max(start, v.currentTime + d));
      flash(d > 0 ? `+${d} s` : `${d} s`);
    },
    [flash],
  );

  const goLive = () => {
    const v = videoRef.current!;
    if (v.seekable.length) v.currentTime = v.seekable.end(v.seekable.length - 1) - 0.5;
    v.play().catch(() => undefined);
  };

  const cycleAspect = useCallback(() => {
    const i = ASPECTS.findIndex((a) => a.value === settingsRef.current.aspect);
    const next = ASPECTS[(i + 1) % ASPECTS.length];
    setSettings({ aspect: next.value });
    flash(`Aspecto: ${next.label}`);
  }, [flash, setSettings]);

  const pickQuality = useCallback(
    (index: number) => {
      engineRef.current?.setLevel(index);
      setMenu(null);
      if (index === -1) {
        flash("Calidad: automática");
        setSettings({ preferredQuality: "auto" });
        return;
      }
      const l = levels.find((x) => x.index === index);
      flash(`Calidad: ${l?.label ?? "—"}`);
      setSettings({ preferredQuality: levelToPref(index, levels) });
    },
    [flash, levels, setSettings],
  );

  const retry = () => {
    attemptRef.current = 0;
    startLoad();
  };

  // ---- controles que se ocultan ----
  const wake = useCallback(() => {
    setControlsOn(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsOn(false), 3200);
  }, []);
  useEffect(() => {
    wake();
  }, [wake, channel?.id]);

  // ---- atajos de teclado ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") return;
      if (t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === " " || k === "k") {
        if (t.tagName === "BUTTON" && k === " ") return; // deja actuar al botón enfocado
        togglePlay();
      } else if (k === "m") toggleMute();
      else if (k === "f") toggleFullscreen();
      else if (k === "p") void togglePip();
      else if (k === "a") cycleAspect();
      else if (k === "arrowup") changeVolume(videoRef.current!.volume + 0.05);
      else if (k === "arrowdown") changeVolume(videoRef.current!.volume - 0.05);
      else if (k === "arrowleft") seekBy(-10);
      else if (k === "arrowright") seekBy(10);
      else if (k === "n" || k === "pagedown") nextRef.current?.();
      else if (k === "b" || k === "pageup") prevRef.current?.();
      else if (k === "h" || k === "?") setMenu((m) => (m === "help" ? null : "help"));
      else handled = false;
      if (handled) {
        e.preventDefault();
        wake();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMute, toggleFullscreen, togglePip, cycleAspect, changeVolume, seekBy, wake]);

  const showUI = controlsOn || paused || menu !== null || status === "error" || status === "reconnecting";
  const seekable = !isLive && isFinite(time.dur) && time.dur > 0;
  const busy = status === "loading" || status === "buffering" || status === "reconnecting";
  const qualityLabel =
    engineKind === "hls"
      ? autoLevel
        ? `Auto${level >= 0 && levels[level] ? `· ${levels[level].label}` : ""}`
        : (levels[level]?.label ?? "—")
      : null;

  const pill = (() => {
    switch (status) {
      case "loading":
        return { text: "Conectando…", cls: "bg-accent2/20 text-accent2" };
      case "buffering":
        return { text: "Almacenando…", cls: "bg-amber-500/20 text-amber-300" };
      case "reconnecting":
        return { text: `Reconectando ${attempt}/${settings.maxRetries}`, cls: "bg-amber-500/20 text-amber-300" };
      case "error":
        return { text: "Sin señal", cls: "bg-red-500/20 text-red-300" };
      case "playing":
        return { text: "Conectado", cls: "bg-emerald-500/20 text-emerald-300" };
      default:
        return { text: channel ? "En pausa" : "Inactivo", cls: "bg-white/10 text-white/70" };
    }
  })();

  const pct = (v: number) => ({ "--fill": `${v * 100}%` }) as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      onMouseMove={wake}
      onTouchStart={wake}
      className={cn(
        "player-root group/player relative w-full select-none overflow-hidden bg-black",
        showUI ? "" : "hide-cursor",
        className,
      )}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        onPointerUp={(e) => {
          if ((e.target as HTMLElement).closest("[data-controls]")) return;
          if (e.pointerType === "mouse") {
            togglePlay();
          } else {
            setMenu(null);
            setControlsOn((v) => !v);
          }
        }}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("[data-controls]")) toggleFullscreen();
        }}
      >
        <video ref={videoRef} playsInline className="bg-black transition-all duration-300" style={videoStyle(settings.aspect)} />
      </div>

      {/* Estado vacío */}
      {!channel && (
        <div className="absolute inset-0 grid place-items-center text-center text-white/70">
          <div>
            <TvIcon className="mx-auto h-14 w-14 text-white/40" />
            <p className="mt-3 text-sm">Selecciona un canal para empezar</p>
          </div>
        </div>
      )}

      {/* Cargando */}
      {channel && busy && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30 anim-fade-up">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="relative">
              <Spinner className="h-14 w-14 text-accent2" />
              <ChannelLogo name={channel.name} logo={channel.logo} className="absolute inset-3 rounded-full" imgClassName="p-0.5" />
            </div>
            <p className="rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur">
              {status === "reconnecting" ? `Reconectando… intento ${attempt} de ${settings.maxRetries}` : status === "buffering" ? "Almacenando en búfer…" : `Conectando con ${channel.name}…`}
            </p>
          </div>
        </div>
      )}

      {/* Reproducción bloqueada / sin autoplay */}
      {channel && blocked && status !== "error" && (
        <button
          data-controls
          onClick={togglePlay}
          aria-label="Reproducir"
          className="absolute inset-0 grid place-items-center bg-black/40"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full grad-primary-br text-white shadow-2xl shadow-accent/50 transition-transform hover:scale-110">
            <PlayIcon className="h-10 w-10 translate-x-0.5" />
          </span>
        </button>
      )}

      {/* Error */}
      {channel && status === "error" && error && (
        <div data-controls className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center backdrop-blur-sm anim-fade-up">
          <div className="max-w-md text-white">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[10px] bg-red-500/15 text-red-400">
              {error.kind === "unsupported" ? <ExclamationTriangleIcon className="h-8 w-8" /> : <SignalSlashIcon className="h-8 w-8" />}
            </div>
            <h3 className="text-lg font-semibold">
              {error.kind === "unsupported" ? "Formato no compatible" : "No se pudo reproducir el canal"}
            </h3>
            <p className="mt-2 text-sm text-white/70">{error.message}</p>
            {!navigator.onLine && <p className="mt-2 text-sm text-amber-300">Parece que no tienes conexión a Internet.</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button onClick={retry} className="inline-flex h-10 items-center gap-2 rounded-[8px] grad-primary px-4 text-sm font-semibold text-white shadow-md shadow-accent/25 hover:brightness-110">
                <ArrowPathIcon className="h-5 w-5" />
                Reintentar
              </button>
              {onNext && (
                <button onClick={onNext} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10">
                  <ForwardIcon className="h-5 w-5" />
                  Siguiente canal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OSD */}
      {osd && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm text-white backdrop-blur anim-fade-up">
          {osd}
        </div>
      )}

      {/* Overlay superior: información del canal */}
      {channel && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 pb-10 text-white transition-opacity duration-300 sm:p-4 sm:pb-12",
            showUI ? "opacity-100" : "opacity-0",
          )}
        >
          <ChannelLogo name={channel.name} logo={channel.logo} className="h-10 w-14 shrink-0 rounded-lg sm:h-12 sm:w-16" imgClassName="p-1" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{channel.name}</p>
            <p className="truncate text-xs text-white/70">
              {channel.category}
              {channel.group && channel.group !== channel.category ? ` · ${channel.group}` : ""}
              {engineKind ? ` · ${engineKind === "hls" ? "HLS" : engineKind === "mpegts" ? "MPEG-TS" : "Nativo"}` : ""}
            </p>
          </div>
          <span className={cn("hidden rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur sm:inline-flex", pill.cls)} role="status">
            {pill.text}
          </span>
        </div>
      )}

      {/* Ayuda de atajos */}
      {menu === "help" && (
        <div data-controls className="absolute right-3 top-16 z-10 w-72 rounded-[10px] border border-white/10 bg-black/85 p-4 text-white shadow-2xl backdrop-blur anim-fade-up">
          <p className="mb-2 text-sm font-semibold">Atajos de teclado</p>
          <dl className="space-y-1.5 text-xs">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt>
                  <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono">{k}</kbd>
                </dt>
                <dd className="text-white/70">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Barra de controles */}
      {channel && (
        <div
          data-controls
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-12 text-white transition-opacity duration-300 sm:px-4 sm:pb-3",
            showUI ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {seekable && (
            <input
              type="range"
              className="nx-range mb-2 w-full"
              aria-label="Progreso"
              min={0}
              max={time.dur}
              step={0.5}
              value={time.cur}
              style={pct(time.cur / time.dur)}
              onChange={(e) => {
                videoRef.current!.currentTime = Number(e.target.value);
              }}
            />
          )}
          <div className="flex items-center gap-1 sm:gap-2">
            {onPrev && <CtrlBtn icon={BackwardIcon} label="Canal anterior (B)" onClick={onPrev} />}
            <CtrlBtn icon={paused ? PlayIcon : PauseIcon} label={paused ? "Reproducir (K)" : "Pausar (K)"} onClick={togglePlay} big />
            {onNext && <CtrlBtn icon={ForwardIcon} label="Canal siguiente (N)" onClick={onNext} />}

            <div className="group/vol flex items-center">
              <CtrlBtn icon={muted || volume === 0 ? SpeakerXMarkIcon : SpeakerWaveIcon} label={muted ? "Activar sonido (M)" : "Silenciar (M)"} onClick={toggleMute} />
              <input
                type="range"
                className="nx-range hidden w-0 opacity-0 transition-all duration-200 group-hover/vol:ml-1 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:ml-1 focus:w-20 focus:opacity-100 sm:block"
                aria-label="Volumen"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                style={pct(muted ? 0 : volume)}
                onChange={(e) => changeVolume(Number(e.target.value))}
              />
            </div>

            <div className="ml-1 flex min-w-0 items-center gap-2 text-xs">
              {isLive ? (
                <button
                  onClick={behindLive ? goLive : undefined}
                  title={behindLive ? "Volver al directo" : "Emisión en directo"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold tracking-wider",
                    behindLive ? "bg-white/15 text-white hover:bg-white/25" : "bg-red-600 text-white",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-white", !behindLive && "live-dot")} />
                  {behindLive ? "IR A DIRECTO" : "EN DIRECTO"}
                </button>
              ) : seekable ? (
                <span className="tabular-nums text-white/80">
                  {formatClock(time.cur)} / {formatClock(time.dur)}
                </span>
              ) : null}
            </div>

            <div className="flex-1" />

            {engineKind === "hls" && channel && (
              <div className="relative">
                <CtrlBtn
                  icon={AdjustmentsHorizontalIcon}
                  label="Calidad"
                  active={menu === "quality"}
                  onClick={() => setMenu(menu === "quality" ? null : "quality")}
                  text={qualityLabel ?? undefined}
                />
                {menu === "quality" && (
                  <Popover title="Calidad">
                    <PopItem active={autoLevel} onClick={() => pickQuality(-1)}>
                      Automática{autoLevel && level >= 0 && levels[level] ? ` (${levels[level].label})` : ""}
                    </PopItem>
                    {[...levels]
                      .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
                      .map((l) => (
                        <PopItem key={l.index} active={!autoLevel && level === l.index} onClick={() => pickQuality(l.index)}>
                          {l.label}
                          <span className="ml-2 text-white/50">{l.bitrate ? `${(l.bitrate / 1e6).toFixed(1)} Mbps` : ""}</span>
                        </PopItem>
                      ))}
                    {levels.length <= 1 && (
                      <p className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-white/45">
                        Este stream solo ofrece una calidad.
                      </p>
                    )}
                  </Popover>
                )}
              </div>
            )}

            <div className="relative">
              <CtrlBtn icon={ViewfinderCircleIcon} label="Relación de aspecto (A)" active={menu === "aspect"} onClick={() => setMenu(menu === "aspect" ? null : "aspect")} />
              {menu === "aspect" && (
                <Popover title="Relación de aspecto">
                  {ASPECTS.map((a) => (
                    <PopItem key={a.value} active={settings.aspect === a.value} onClick={() => { setSettings({ aspect: a.value }); setMenu(null); }}>
                      {a.label}
                    </PopItem>
                  ))}
                </Popover>
              )}
            </div>

            <CtrlBtn icon={CommandLineIcon} label="Atajos de teclado (H)" onClick={() => setMenu(menu === "help" ? null : "help")} className="hidden sm:grid" />
            {pipSupported && <CtrlBtn icon={RectangleStackIcon} label="Imagen en imagen (P)" active={pip} onClick={() => void togglePip()} />}
            <CtrlBtn icon={fullscreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon} label={fullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"} onClick={toggleFullscreen} />
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({
  icon: Icon,
  label,
  onClick,
  big,
  active,
  className,
  text,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  big?: boolean;
  active?: boolean;
  className?: string;
  text?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "shrink-0 select-none rounded-[8px] text-white/90 transition-all duration-150 hover:bg-white/15 hover:text-white active:scale-90",
        text ? "inline-flex h-9 items-center justify-center gap-1.5 px-2.5" : "grid place-items-center",
        big ? "h-10 w-10 sm:h-11 sm:w-11" : "h-9 w-9",
        active && "bg-white/15 text-accent2",
        className,
      )}
    >
      <Icon className={big ? "h-7 w-7" : "h-5 w-5 sm:h-6 sm:w-6"} />
      {text && <span className="hidden whitespace-nowrap text-[11px] font-bold tracking-wide tabular-nums sm:inline">{text}</span>}
    </button>
  );
}

function Popover({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-12 right-0 z-10 min-w-44 rounded-[10px] border border-white/10 bg-black/90 p-1.5 shadow-2xl backdrop-blur anim-fade-up">
      <p className="px-3 pb-1 pt-1.5 text-[11px] uppercase tracking-wider text-white/50">{title}</p>
      {children}
    </div>
  );
}

function PopItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
        active ? "text-accent2" : "text-white",
      )}
    >
      <span>{children}</span>
      {active && <span className="ml-3 h-1.5 w-1.5 rounded-full bg-accent2" />}
    </button>
  );
}
