import { useEffect } from "react";
import {
  ArrowDownTrayIcon,
  CodeBracketIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PlayIcon,
  QueueListIcon,
  ShieldCheckIcon,
  SunIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { IconButton, type IconType } from "./ui";

const REPO_URL = "https://github.com/novacode-crypto/iptv-player";
const ZIP_URL = "nexa-iptv-aurora.zip";

const FEATURES: { icon: IconType; tile: string; title: string; text: string }[] = [
  {
    icon: QueueListIcon,
    tile: "bg-brand-blue",
    title: "Listas M3U · M3U8",
    text: "Importa por URL o archivo, con detección de duplicados y categorías automáticas.",
  },
  {
    icon: PlayIcon,
    tile: "bg-accent",
    title: "Reproductor premium",
    text: "HLS y MPEG-TS vía hls.js y mpegts.js: volumen, pantalla completa y ocultar cursor.",
  },
  {
    icon: HeartIcon,
    tile: "bg-brand-pink",
    title: "Favoritos y recientes",
    text: "Marca tus canales y retoma la emisión justo donde la dejaste.",
  },
  {
    icon: MagnifyingGlassIcon,
    tile: "bg-brand-teal",
    title: "Búsqueda instantánea",
    text: "Encuentra canales por nombre, grupo o tvg-id mientras escribes.",
  },
  {
    icon: SunIcon,
    tile: "bg-brand-yellow",
    title: "Tema claro y oscuro",
    text: "Conmuta sol/luna desde el topbar; también sigue tu preferencia del sistema.",
  },
  {
    icon: ShieldCheckIcon,
    tile: "bg-gradient-to-br from-brand-blue to-brand-teal",
    title: "Privado por diseño",
    text: "Sin cuentas ni telemetría: listas e historial viven solo en tu dispositivo (IndexedDB).",
  },
];

const STACK = ["React 19", "TypeScript", "Vite", "Tailwind CSS 4", "Zustand", "hls.js", "mpegts.js", "IndexedDB"];
const STATS = [
  { k: "0", v: "cuentas necesarias" },
  { k: "100%", v: "local y privado" },
  { k: "2", v: "protocolos: HLS · MPEG-TS" },
  { k: "M3U", v: "listas: URL o archivo" },
];

/** Contenido de la landing de producto (también se muestra dentro del panel lateral) */
export function LandingContent() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {/* Héroe */}
      <section className="hero-bg relative overflow-hidden rounded-[10px] p-5 shadow-card sm:p-6">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
            <MoonIcon className="h-3 w-3" /> Nueva UI Aurora
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            NEXA <span className="text-accent2">IPTV</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
            Reproductor IPTV privado: importa tus propias listas M3U/M3U8, organiza los canales y míralos
            en directo con un reproductor premium. Todo se guarda en tu dispositivo, sin cuentas.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <a
              href={ZIP_URL}
              download
              className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-white px-5 text-sm font-bold text-[#3b2f8f] shadow-lg shadow-black/25 transition-all hover:brightness-95 active:scale-[0.98]"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Descargar ZIP
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <CodeBracketIcon className="h-5 w-5" />
              Ver repositorio
            </a>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-white/55">
            El ZIP incluye el código fuente y los scripts .bat para Windows (START, BUILD, STOP…).
          </p>
        </div>
      </section>

      {/* Cifras clave */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.v} className="rounded-[10px] border border-line bg-surface p-3 shadow-xs">
            <p className="text-lg font-extrabold text-ink">{s.k}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-mute">{s.v}</p>
          </div>
        ))}
      </section>

      {/* Características */}
      <section>
        <h2 className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-mute">Todo lo que necesitas</h2>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="flex gap-3 rounded-[10px] border border-line bg-surface p-3.5 shadow-xs transition-shadow hover:shadow-card">
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-white shadow-sm", f.tile)}>
                <f.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-ink">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-mute">{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Stack técnico */}
      <section className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-mute">Hecho con</h2>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {STACK.map((t) => (
            <li key={t} className="rounded-[8px] border border-line bg-surface2 px-2.5 py-1 text-[11px] font-medium text-ink/80">
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Pie */}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-[11px] text-mute">
        <p>© 2026 NEXA IPTV · uso privado y local</p>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
          novacode-crypto/iptv-player
        </a>
      </footer>
    </div>
  );
}

/** Panel lateral deslizante que muestra la landing y el enlace de descarga del ZIP */
export function SidePanel() {
  const open = useStore((s) => s.meta.landingOpen);
  const setMeta = useStore((s) => s.setMeta);
  const close = () => setMeta({ landingOpen: false });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <div
        onClick={close}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-[#100c22]/45 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal={open}
        aria-label="Landing y descarga de NEXA IPTV"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col border-l border-line bg-surface shadow-2xl transition-transform duration-300 ease-out md:inset-y-3 md:rounded-l-[10px] md:border",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3 pl-4">
          <p className="text-sm font-bold tracking-wide text-ink">
            NEXA <span className="text-accent">IPTV</span>
            <span className="ml-2 text-xs font-medium text-mute">landing · descarga</span>
          </p>
          <IconButton icon={XMarkIcon} label="Cerrar panel" onClick={close} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <LandingContent />
        </div>
      </aside>
    </>
  );
}
