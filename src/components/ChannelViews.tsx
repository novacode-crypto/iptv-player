import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HeartIcon as HeartOutline, PlayIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";
import { initials } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { Tooltip } from "./ui";

const PALETTE = ["#7C5CFC", "#2BD9C7", "#4A7CF7", "#F06BB3", "#F5A623", "#38B6D8", "#9B6BF3", "#8B5CF6"];
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Logotipo con carga diferida y avatar de iniciales como alternativa */
export const ChannelLogo = memo(function ChannelLogo({
  name,
  logo,
  className,
  imgClassName,
}: {
  name: string;
  logo: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  const c = colorFor(name);
  return (
    <div
      className={cn("grid place-items-center overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${c}33, ${c}0d)` }}
    >
      {logo && !failed ? (
        <img
          src={logo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-contain p-2", imgClassName)}
        />
      ) : (
        <span className="font-bold tracking-wide" style={{ color: c, fontSize: "1.4em" }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
});

export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const fav = useStore((s) => !!s.favorites[id]);
  const toggle = useStore((s) => s.toggleFavorite);
  const Icon = fav ? HeartSolid : HeartOutline;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle(id);
      }}
      aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={fav}
      title={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-[8px] backdrop-blur transition-all duration-200 hover:scale-110",
        fav ? "bg-brand-pink/20 text-brand-pink" : "bg-black/40 text-white/80 hover:text-white",
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

function relTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "hace un instante";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Estado de un canal: punto de color + tooltip premium con el motivo y la antigüedad */
export function StatusDot({ id, className }: { id: string; className?: string }) {
  const st = useStore((s) => s.status[id]);
  if (!st) return null;
  return (
    <Tooltip
      label={st.ok ? "Stream en línea" : "Stream caído"}
      hint={st.ok ? `Comprobado ${relTime(st.at)}` : `${st.reason ?? "Motivo desconocido"} · ${relTime(st.at)}`}
    >
      <span
        className={cn(
          "inline-flex h-2.5 w-2.5 cursor-help rounded-full ring-2 ring-black/30 transition-transform hover:scale-125",
          st.ok ? "bg-emerald-400" : "bg-red-500",
          className,
        )}
      />
    </Tooltip>
  );
}

/** Etiqueta «CAÍDO» con tooltip del motivo, para tarjetas y filas marcadas */
export function OfflineBadge({ id, className }: { id: string; className?: string }) {
  const st = useStore((s) => s.status[id]);
  if (!st || st.ok) return null;
  return (
    <Tooltip label="Canal no disponible" hint={`${st.reason ?? "Motivo desconocido"} · ${relTime(st.at)}`}>
      <span
        className={cn(
          "inline-flex h-5 shrink-0 cursor-help items-center rounded-[6px] bg-red-500/15 px-1.5 text-[10px] font-bold tracking-wider text-red-500 ring-1 ring-red-500/40 backdrop-blur",
          className,
        )}
      >
        CAÍDO
      </span>
    </Tooltip>
  );
}

export const ChannelCard = memo(function ChannelCard({
  channel,
  listName,
  onPlay,
  highlight,
}: {
  channel: Channel;
  listName?: string;
  onPlay: (id: string) => void;
  highlight?: boolean;
}) {
  const down = useStore((s) => s.status[channel.id]?.ok === false);
  return (
    <div
      role="button"
      tabIndex={0}
      data-down={down ? "true" : undefined}
      onClick={() => onPlay(channel.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPlay(channel.id))}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[10px] border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        down ? "border-red-500/45 opacity-80" : highlight ? "border-accent" : "border-line hover:border-accent/60",
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 bg-surface2">
        <ChannelLogo name={channel.name} logo={channel.logo} className="h-full w-full" imgClassName={cn("p-4", down && "opacity-60 grayscale-[35%]")} />
        <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full grad-primary-br text-white shadow-lg shadow-accent/40">
            <PlayIcon className="h-6 w-6 translate-x-px" />
          </span>
        </div>
        <FavoriteButton id={channel.id} className="absolute right-2 top-2" />
        <StatusDot id={channel.id} className="absolute left-2 top-2" />
        {down && <OfflineBadge id={channel.id} className="absolute bottom-2 left-2" />}
      </div>
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <p className="truncate text-sm font-semibold" title={channel.name}>
          {channel.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-mute">
          {channel.category}
          {listName ? ` · ${listName}` : ""}
        </p>
      </div>
    </div>
  );
});

export const ChannelRow = memo(function ChannelRow({
  channel,
  listName,
  onPlay,
  highlight,
  compact,
  trailing,
}: {
  channel: Channel;
  listName?: string;
  onPlay: (id: string) => void;
  highlight?: boolean;
  compact?: boolean;
  trailing?: ReactNode;
}) {
  const down = useStore((s) => s.status[channel.id]?.ok === false);
  return (
    <div
      role="button"
      tabIndex={0}
      data-down={down ? "true" : undefined}
      onClick={() => onPlay(channel.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPlay(channel.id))}
      className={cn(
        "group flex h-full cursor-pointer items-center gap-3 rounded-[8px] border px-3 transition-all duration-200 hover:border-accent/50 hover:bg-surface2",
        down
          ? "border-red-500/35 bg-red-500/[0.04]"
          : highlight
            ? "border-accent bg-accent/10"
            : "border-transparent bg-surface/70",
      )}
    >
      <ChannelLogo name={channel.name} logo={channel.logo} className={cn("shrink-0 rounded-lg", compact ? "h-9 w-12" : "h-11 w-16", down && "opacity-70 grayscale-[35%]")} imgClassName="p-1" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", down && "opacity-80")} title={channel.name}>
          {channel.name}
        </p>
        <p className="truncate text-xs text-mute">
          {channel.category}
          {channel.group && channel.group !== channel.category ? ` · ${channel.group}` : ""}
          {listName ? ` · ${listName}` : ""}
        </p>
      </div>
      {down && <OfflineBadge id={channel.id} />}
      <StatusDot id={channel.id} />
      {trailing}
      <FavoriteButton id={channel.id} className="bg-transparent! text-mute" />
    </div>
  );
});

/**
 * Virtualización por ventanas: solo se renderizan las filas visibles (+ colchón),
 * de modo que miles de canales no penalizan la memoria ni el scroll.
 */
export function VirtualChannels({
  items,
  mode,
  minCardWidth = 190,
  rowHeight = 64,
  gap = 12,
  renderItem,
  className,
}: {
  items: Channel[];
  mode: "grid" | "list";
  minCardWidth?: number;
  rowHeight?: number;
  gap?: number;
  renderItem: (c: Channel) => ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [top, setTop] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // volver arriba cuando cambia el conjunto de resultados
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setTop(0);
  }, [items, mode]);

  const pad = 4;
  const inner = Math.max(0, size.w - pad * 2 - 8);
  const cols = mode === "grid" ? Math.max(1, Math.floor((inner + gap) / (minCardWidth + gap))) : 1;
  const cardW = mode === "grid" ? (inner - gap * (cols - 1)) / cols : inner;
  const itemH = mode === "grid" ? Math.round(cardW * 0.625) + 62 : rowHeight;
  const rowStride = itemH + gap;
  const rows = Math.ceil(items.length / cols);
  const total = rows * rowStride;

  const overscan = 3;
  const first = Math.max(0, Math.floor(top / rowStride) - overscan);
  const last = Math.min(rows - 1, Math.ceil((top + size.h) / rowStride) + overscan);

  const out: ReactNode[] = [];
  for (let r = first; r <= last; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i >= items.length) break;
      out.push(
        <div
          key={items[i].id}
          className="absolute"
          style={{ top: r * rowStride, left: c * (cardW + gap), width: cardW, height: itemH }}
        >
          {renderItem(items[i])}
        </div>,
      );
    }
  }

  return (
    <div ref={scrollRef} onScroll={(e) => setTop(e.currentTarget.scrollTop)} className={cn("overflow-y-auto", className)}>
      <div className="relative" style={{ height: total, margin: `0 ${pad}px` }}>
        {size.w > 0 && out}
      </div>
    </div>
  );
}
