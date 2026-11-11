import { useEffect, useRef } from "react";
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
  QueueListIcon,
  SignalIcon,
  SignalSlashIcon,
  Squares2X2Icon,
  TvIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { navigate, useRoute, type Route } from "@/lib/router";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { IconButton, Spinner, type IconType } from "./ui";

const NAV: { route: Route; label: string; icon: IconType; badge?: "channels" | "favorites" | "playlists" }[] = [
  { route: "/", label: "Inicio", icon: HomeIcon },
  { route: "/channels", label: "Todos los canales", icon: Squares2X2Icon, badge: "channels" },
  { route: "/favorites", label: "Favoritos", icon: HeartIcon, badge: "favorites" },
  { route: "/recents", label: "Recientes", icon: ClockIcon },
  { route: "/playlists", label: "Listas IPTV", icon: QueueListIcon, badge: "playlists" },
  { route: "/settings", label: "Configuración", icon: Cog6ToothIcon },
];

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-white shadow-lg shadow-accent/30">
        <TvIcon className="h-6 w-6" />
      </div>
      {!collapsed && (
        <div className="leading-none">
          <div className="text-lg font-extrabold tracking-wide">
            NEXA <span className="gradient-text">IPTV</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-mute">Tu centro multimedia</div>
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
        "relative hidden shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur transition-[width] duration-300 md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
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
                "group relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-0",
                active ? "bg-gradient-to-r from-accent/25 to-accent2/10 text-ink" : "text-mute hover:bg-ink/5 hover:text-ink",
              )}
            >
              {active && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-accent" />}
              <n.icon className={cn("h-5 w-5 shrink-0", active && "text-accent2")} />
              {!collapsed && <span className="flex-1 truncate text-left">{n.label}</span>}
              {!collapsed && count > 0 && (
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-mute">{count.toLocaleString("es-ES")}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        <button
          onClick={() => setMeta({ sidebarCollapsed: !collapsed })}
          aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs text-mute transition-colors hover:bg-ink/5 hover:text-ink"
        >
          {collapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
          {!collapsed && "Contraer"}
        </button>
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
            className={cn("flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors", active ? "text-accent2" : "text-mute")}
          >
            <n.icon className="h-5 w-5" />
            <span className="max-w-full truncate px-0.5">{n.label.replace("Todos los canales", "Canales").replace("Listas IPTV", "Listas").replace("Configuración", "Ajustes")}</span>
          </button>
        );
      })}
    </nav>
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
    <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <div className="mr-1 md:hidden">
        <Logo collapsed />
      </div>
      <div className="relative min-w-0 flex-1 sm:max-w-xl">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-mute" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar canales, categorías, tvg-id…"
          aria-label="Buscar canales"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-16 text-sm outline-none transition-colors placeholder:text-mute focus:border-accent"
        />
        {query ? (
          <button onClick={() => setQuery("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-mute hover:text-ink">
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-mute sm:block">Ctrl K</kbd>
        )}
      </div>

      {playlists.length > 0 && (
        <select
          aria-label="Lista activa"
          value={active}
          onChange={(e) => setMeta({ activePlaylist: e.target.value })}
          className="h-10 w-24 shrink-0 rounded-xl border border-line bg-surface px-2 text-sm outline-none hover:border-accent/50 focus:border-accent sm:w-52 sm:px-3"
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

      <div
        className={cn(
          "hidden h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-medium lg:flex",
          online ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400",
        )}
        role="status"
      >
        {importing ? <Spinner className="h-4 w-4" /> : online ? <SignalIcon className="h-4 w-4" /> : <SignalSlashIcon className="h-4 w-4" />}
        {importing ? "Importando…" : online ? "En línea" : "Sin conexión"}
      </div>
      <IconButton icon={Cog6ToothIcon} label="Configuración" onClick={() => navigate("/settings")} className="hidden sm:grid" />
    </header>
  );
}

export function OfflineBanner() {
  const online = useStore((s) => s.online);
  if (online) return null;
  return (
    <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-6 py-2 text-sm text-red-300 anim-fade-up" role="alert">
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
              "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-surface2/95 p-3.5 pr-2 shadow-2xl backdrop-blur anim-toast",
              t.kind === "success" && "border-emerald-500/40",
              t.kind === "error" && "border-red-500/40",
              t.kind === "info" && "border-accent2/40",
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", t.kind === "success" && "text-emerald-400", t.kind === "error" && "text-red-400", t.kind === "info" && "text-accent2")} />
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <IconButton icon={XMarkIcon} label="Cerrar notificación" onClick={() => dismiss(t.id)} className="h-7 w-7" />
          </div>
        );
      })}
    </div>
  );
}
