import { useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  HomeIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  QueueListIcon,
  SignalIcon,
  SignalSlashIcon,
  Squares2X2Icon,
  SunIcon,
  TvIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { navigate, useRoute, type Route } from "@/lib/router";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { IconButton, Spinner, type IconType } from "./ui";

/** Cada sección lleva su icono de color, como el panel de referencia */
const NAV: { route: Route; label: string; icon: IconType; tile: string; badge?: "channels" | "favorites" | "playlists" }[] = [
  { route: "/", label: "Inicio", icon: HomeIcon, tile: "bg-accent" },
  { route: "/channels", label: "Canales", icon: Squares2X2Icon, tile: "bg-brand-blue", badge: "channels" },
  { route: "/favorites", label: "Favoritos", icon: HeartIcon, tile: "bg-brand-pink", badge: "favorites" },
  { route: "/recents", label: "Recientes", icon: ClockIcon, tile: "bg-brand-teal" },
  { route: "/playlists", label: "Listas IPTV", icon: QueueListIcon, tile: "bg-brand-yellow", badge: "playlists" },
  { route: "/settings", label: "Ajustes", icon: Cog6ToothIcon, tile: "bg-white/15" },
];

export function Logo({ collapsed, dark = true }: { collapsed?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] grad-primary-br text-white shadow-lg shadow-black/20",
          dark && "shadow-accent/30",
        )}
      >
        <TvIcon className="h-6 w-6" />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 items-baseline gap-1.5 text-lg font-extrabold tracking-wide">
          <span className={dark ? "text-white" : "text-ink"}>NEXA</span>
          <span className={dark ? "text-accent2" : "gradient-text"}>IPTV</span>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const route = useRoute();
  const collapsed = useStore((s) => s.meta.sidebarCollapsed);
  const setMeta = useStore((s) => s.setMeta);
  const nChannels = useStore((s) => s.channels.length);
  const nFavs = useStore((s) => Object.keys(s.favorites).length);
  const nLists = useStore((s) => s.playlists.length);
  const counts = { channels: nChannels, favorites: nFavs, playlists: nLists };

  return (
    <aside
      className={cn(
        "sidebar-bg relative hidden shrink-0 flex-col overflow-hidden rounded-[10px] text-white shadow-card transition-[width] duration-300 md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b border-white/10", collapsed ? "justify-center" : "px-4")}>
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegación principal">
        {NAV.map((n) => {
          const active = route === n.route;
          const count = n.badge ? counts[n.badge] : 0;
          return (
            <button
              key={n.route}
              onClick={() => navigate(n.route)}
              title={n.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-11 w-full items-center gap-3 rounded-[8px] px-2 transition-all duration-200",
                collapsed && "justify-center px-0",
                active ? "bg-white/12" : "hover:bg-white/8",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-white shadow-sm transition-colors duration-200",
                  active ? "bg-white text-accent" : n.tile,
                )}
              >
                <n.icon className="h-[18px] w-[18px]" />
              </span>
              {!collapsed && <span className="flex-1 truncate text-left text-sm font-medium text-side-ink/95">{n.label}</span>}
              {!collapsed && count > 0 && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-side-mute">{count.toLocaleString("es-ES")}</span>
              )}
              {!collapsed && <ChevronRightIcon className="h-3.5 w-3.5 text-side-mute/60 transition-transform duration-200 group-hover:translate-x-0.5" />}
            </button>
          );
        })}
      </nav>

      {/* Pie discreto: copyright; el plegado queda como icono mínimo */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className={cn("flex h-6 items-center gap-1", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <p className="select-none truncate text-[10px] leading-none text-side-mute/45">© 2026 NEXA IPTV · uso privado</p>}
          <button
            onClick={() => setMeta({ sidebarCollapsed: !collapsed })}
            aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            title={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-side-mute/40 transition-colors hover:bg-white/10 hover:text-white/90"
          >
            {collapsed ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <ChevronLeftIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const route = useRoute();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      {NAV.map((n) => {
        const active = route === n.route;
        return (
          <button
            key={n.route}
            onClick={() => navigate(n.route)}
            aria-label={n.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-mute",
            )}
          >
            {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full grad-primary" />}
            <n.icon className={cn("h-5 w-5", active && "text-accent")} />
            <span className="max-w-full truncate px-0.5">{n.label.replace("Todos los canales", "Canales").replace("Listas IPTV", "Listas").replace("Configuración", "Ajustes")}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Resuelve si el tema efectivo actual es oscuro (configuración o sistema) */
function useResolvedDark() {
  const theme = useStore((s) => s.settings.theme);
  const [sysDark, setSysDark] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSysDark(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return theme === "dark" || (theme === "system" && sysDark);
}

/** Conmutador de tema sol/luna, al estilo de los controles segmentados del panel */
export function ThemeToggle() {
  const dark = useResolvedDark();
  const setSettings = useStore((s) => s.setSettings);
  return (
    <div className="inline-flex shrink-0 rounded-full border border-line bg-surface2 p-0.5" role="group" aria-label="Cambiar tema">
      <button
        onClick={() => setSettings({ theme: "light" })}
        aria-label="Tema claro"
        aria-pressed={!dark}
        title="Tema claro"
        className={cn(
          "grid h-7 w-8 place-items-center rounded-full transition-all duration-200",
          !dark ? "grad-primary text-white shadow-sm shadow-accent/30" : "text-mute hover:text-ink",
        )}
      >
        <SunIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setSettings({ theme: "dark" })}
        aria-label="Tema oscuro"
        aria-pressed={dark}
        title="Tema oscuro"
        className={cn(
          "grid h-7 w-8 place-items-center rounded-full transition-all duration-200",
          dark ? "grad-primary text-white shadow-sm shadow-accent/30" : "text-mute hover:text-ink",
        )}
      >
        <MoonIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Reloj digital premium del topbar: hora local con segundos parpadeantes y fecha */
function DigitalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  const fecha = now.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" });
  const iso = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  return (
    <div
      role="timer"
      aria-label={`Hora local ${iso}`}
      className="hidden h-10 shrink-0 select-none items-center gap-3 rounded-[8px] border border-line bg-surface2 px-3 sm:flex"
    >
      <span className="hidden flex-col leading-none lg:flex" aria-hidden>
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-mute">{fecha}</span>
        <span className="mt-1 h-[3px] w-9 rounded-full grad-primary opacity-80" />
      </span>
      <time dateTime={iso} className="clock-digits flex items-baseline text-[17px] font-bold tabular-nums tracking-[0.04em] text-ink">
        {p(now.getHours())}
        <span className="clock-colon text-accent2">:</span>
        {p(now.getMinutes())}
        <span className="clock-colon text-accent2">:</span>
        <span className="text-[12px] font-semibold text-mute">{p(now.getSeconds())}</span>
      </time>
    </div>
  );
}

export function Header() {
  const route = useRoute();
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const playlists = useStore((s) => s.playlists);
  const active = useStore((s) => s.meta.activePlaylist);
  const setMeta = useStore((s) => s.setMeta);
  const online = useStore((s) => s.online);
  const importing = useStore((s) => s.jobs.some((j) => j.stage === "reading" || j.stage === "parsing" || j.stage === "saving"));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onChange = (v: string) => {
    setQuery(v);
    if (v && route !== "/channels" && route !== "/favorites") navigate("/channels");
  };

  return (
    <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-5 md:rounded-[10px] md:border-none md:shadow-card">
      <div className="mr-1 md:hidden">
        <Logo collapsed dark={false} />
      </div>
      <div className="relative min-w-0 flex-1 sm:max-w-xl">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-mute" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar canales, categorías, tvg-id…"
          aria-label="Buscar canales"
          className="h-10 w-full rounded-[8px] border border-transparent bg-surface2 pl-10 pr-16 text-sm outline-none transition-all placeholder:text-mute focus:border-accent focus:bg-surface"
        />
        {query ? (
          <button onClick={() => setQuery("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[6px] text-mute hover:text-ink">
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-[6px] border border-line bg-surface px-1.5 py-0.5 text-[10px] text-mute sm:block">Ctrl K</kbd>
        )}
      </div>

      {playlists.length > 0 && (
        <select
          aria-label="Lista activa"
          value={active}
          onChange={(e) => setMeta({ activePlaylist: e.target.value })}
          className="hidden h-10 w-40 shrink-0 rounded-[8px] border border-line bg-surface2 px-2 text-sm outline-none transition-colors hover:border-accent/50 focus:border-accent sm:block sm:w-48 sm:px-3"
        >
          <option value="all">Todas las listas</option>
          {playlists
            .filter((p) => p.enabled)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <DigitalClock />

        <div
          className={cn(
            "hidden h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold lg:flex",
            online
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600"
              : "border-red-500/25 bg-red-500/10 text-red-500",
          )}
          role="status"
        >
          {importing ? <Spinner className="h-4 w-4" /> : online ? <SignalIcon className="h-4 w-4" /> : <SignalSlashIcon className="h-4 w-4" />}
          {importing ? "Importando…" : online ? "En línea" : "Sin conexión"}
        </div>

        <IconButton icon={Cog6ToothIcon} label="Configuración" onClick={() => navigate("/settings")} className="hidden sm:grid" />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function OfflineBanner() {
  const online = useStore((s) => s.online);
  if (online) return null;
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 anim-fade-up md:mt-3" role="alert">
      <SignalSlashIcon className="h-5 w-5 shrink-0" />
      Sin conexión a Internet. Tus listas guardadas siguen disponibles, pero la reproducción y las actualizaciones requieren red.
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-50 flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 md:bottom-6 md:right-6" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.kind === "success" ? CheckCircleIcon : t.kind === "error" ? ExclamationTriangleIcon : InformationCircleIcon;
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-[10px] border bg-surface p-3.5 pr-2 shadow-2xl anim-toast",
              t.kind === "success" && "border-emerald-500/40",
              t.kind === "error" && "border-red-500/40",
              t.kind === "info" && "border-accent/40",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                t.kind === "success" && "text-emerald-500",
                t.kind === "error" && "text-red-500",
                t.kind === "info" && "text-accent",
              )}
            />
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <IconButton icon={XMarkIcon} label="Cerrar notificación" onClick={() => dismiss(t.id)} className="h-7 w-7" />
          </div>
        );
      })}
    </div>
  );
}
