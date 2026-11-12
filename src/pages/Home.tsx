import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpTrayIcon,
  ChartBarIcon,
  ChartPieIcon,
  ClockIcon,
  HeartIcon,
  LockClosedIcon,
  PlayIcon,
  PlusIcon,
  QueueListIcon,
  ShieldCheckIcon,
  SignalIcon,
  Squares2X2Icon,
  SparklesIcon,
  TvIcon,
} from "@heroicons/react/24/outline";
import { ChannelCard, ChannelLogo } from "@/components/ChannelViews";
import { Badge, Button, EmptyState, SectionTitle, Segmented, Skeleton, type IconType } from "@/components/ui";
import { navigate } from "@/lib/router";
import { usePlaylistNames, useStore, useVisibleChannels } from "@/lib/store";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/utils/cn";

const CAT_COLORS = ["var(--c-accent)", "var(--c-teal)", "var(--c-blue)", "var(--c-pink)", "var(--c-yellow)"];

/** Tarjeta de estadística con icono de color, como las del panel de referencia */
function Stat({ icon: Icon, tile, label, value, hint }: { icon: IconType; tile: string; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
        <span className={cn("grid h-9 w-9 place-items-center rounded-[8px] text-white shadow-sm", tile)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[28px] font-extrabold leading-none tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-mute">{hint}</p>}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">{children}</div>;
}

/** Actividad de reproducción: barras por día con conmutador 7/30 días */
function ActivityCard({ history }: { history: { id: string; playedAt: number; count: number; name: string }[] }) {
  const [range, setRange] = useState<"7" | "30">("7");
  const days = Number(range);

  const buckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: { key: number; date: Date; plays: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      list.push({ key: d.getTime(), date: d, plays: 0 });
    }
    const byKey = new Map(list.map((b) => [b.key, b]));
    const d0 = list[0].key;
    for (const h of history) {
      const dt = new Date(h.playedAt);
      const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
      const b = byKey.get(key);
      if (b && h.playedAt >= d0) b.plays += h.count;
    }
    return list;
  }, [history, days]);

  const total = buckets.reduce((s, b) => s + b.plays, 0);
  const max = Math.max(1, ...buckets.map((b) => b.plays));
  const fmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" });

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col rounded-[10px] border border-line bg-surface p-5 shadow-card anim-fade-up">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={ChartBarIcon} title="Actividad de reproducción" />
        <Segmented<"7" | "30">
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 días" },
            { value: "30", label: "30 días" },
          ]}
        />
      </div>

      {total === 0 ? (
        <p className="flex min-h-32 flex-1 items-center justify-center rounded-[8px] border border-dashed border-line text-sm text-mute">
          Aún no hay reproducciones en este periodo.
        </p>
      ) : (
        <>
          <div className="flex min-h-28 flex-1 items-end gap-[3px] sm:gap-1.5" role="img" aria-label={`Reproducciones por día: ${total} en total`}>
            {buckets.map((b) => (
              <div
                key={b.key}
                className="group/bar flex h-full flex-1 flex-col justify-end"
                title={`${fmt.format(b.date)} · ${b.plays} ${b.plays === 1 ? "reproducción" : "reproducciones"}`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-[4px] transition-opacity duration-200",
                    b.plays === 0 ? "bg-surface2" : "grad-primary",
                  )}
                  style={{ height: b.plays === 0 ? "6px" : `${Math.max(12, (b.plays / max) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          {range === "7" && (
            <div className="mt-2 flex shrink-0 gap-[3px] text-center text-[10px] font-medium text-mute sm:gap-1.5">
              {buckets.map((b) => (
                <span key={b.key} className="flex-1 truncate">
                  {new Intl.DateTimeFormat("es-ES", { weekday: "narrow" }).format(b.date)}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 shrink-0 text-xs text-mute">
            <span className="font-semibold text-ink">{total.toLocaleString("es-ES")}</span> {total === 1 ? "reproducción" : "reproducciones"} en los últimos {days} días
          </p>
        </>
      )}
    </section>
  );
}

/** Distribución por categorías: gráfico de anillo con leyenda */
function CategoriesCard({ counts }: { counts: [string, number][] }) {
  const total = counts.reduce((s, [, n]) => s + n, 0);
  const top = counts.slice(0, 5);
  const rest = counts.slice(5).reduce((s, [, n]) => s + n, 0);
  const slices = top.map(([name, n], i) => ({ name, n, color: CAT_COLORS[i] }));
  if (rest > 0) slices.push({ name: "Resto", n: rest, color: "rgb(138 136 163 / 0.35)" });

  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[10px] border border-line bg-surface p-5 shadow-card anim-fade-up">
      <SectionTitle icon={ChartPieIcon} title="Categorías" />
      {total === 0 ? (
        <p className="flex min-h-40 flex-1 items-center justify-center text-sm text-mute">Importa una lista para ver su distribución.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          <div className="relative shrink-0">
            <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--c-surface2)" strokeWidth="20" />
              {slices.map((s) => {
                const len = (s.n / total) * C;
                const el = (
                  <circle
                    key={s.name}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="20"
                    strokeDasharray={`${Math.max(0, len - 2)} ${C - len + 2}`}
                    strokeDashoffset={-acc}
                  />
                );
                acc += len;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-extrabold tabular-nums leading-none">{total.toLocaleString("es-ES")}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-mute">canales</p>
              </div>
            </div>
          </div>
          <ul className="w-full min-w-0 space-y-2">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-2.5 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 leading-snug">{s.name}</span>
                <span className="w-10 shrink-0 text-right text-xs font-medium text-mute">{Math.round((s.n / total) * 100)}%</span>
                <span className="w-14 shrink-0 text-right font-semibold tabular-nums">{s.n.toLocaleString("es-ES")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function HomePage() {
  const ready = useStore((s) => s.ready);
  const playlists = useStore((s) => s.playlists);
  const channels = useStore((s) => s.channels);
  const channelMap = useStore((s) => s.channelMap);
  const favorites = useStore((s) => s.favorites);
  const history = useStore((s) => s.history);
  const lastId = useStore((s) => s.currentChannelId);
  const play = useStore((s) => s.play);
  const importDemo = useStore((s) => s.importDemo);
  const names = usePlaylistNames();
  const visible = useVisibleChannels();

  const favChannels = useMemo(
    () =>
      Object.entries(favorites)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => channelMap.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .slice(0, 14),
    [favorites, channelMap],
  );
  const recentChannels = useMemo(
    () =>
      history
        .map((h) => channelMap.get(h.id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .slice(0, 14),
    [history, channelMap],
  );
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of visible) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visible]);

  if (!ready) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <Skeleton className="h-52" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  // ---- Primera ejecución / sin listas ----
  if (playlists.length === 0) {
    return (
      <div className="bg-aurora flex flex-1 flex-col justify-center p-4 sm:p-8">
        <div className="mx-auto max-w-3xl pt-6 text-center anim-fade-up">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-[14px] grad-primary-br text-white shadow-2xl shadow-accent/40">
            <TvIcon className="h-11 w-11" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Bienvenido a <span className="gradient-text">NEXA IPTV</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-mute">
            Tu centro multimedia personal. Importa tus propias listas M3U/M3U8 y reprodúcelas con un reproductor premium. Todo se guarda en tu dispositivo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="primary" size="lg" icon={PlusIcon} onClick={() => navigate("/playlists")}>
              Añadir mi primera lista
            </Button>
            <Button size="lg" icon={SparklesIcon} onClick={() => void importDemo()}>
              Probar con lista de demostración
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-12 grid w-full gap-4 sm:grid-cols-3">
          {[
            { icon: ArrowUpTrayIcon, tile: "bg-brand-blue", t: "Importa lo tuyo", d: "Desde una URL o un archivo local. Se guarda una copia, aunque la fuente desaparezca." },
            { icon: LockClosedIcon, tile: "bg-brand-teal", t: "Privado por diseño", d: "Sin cuentas, sin telemetría. Tus listas nunca salen de tu navegador." },
            { icon: ShieldCheckIcon, tile: "bg-brand-pink", t: "Responsabilidad", d: "Usa solo fuentes de contenido que tengas autorización para utilizar." },
          ].map((f, i) => (
            <div key={f.t} className="rounded-[10px] border border-line bg-surface p-5 shadow-card anim-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <span className={cn("grid h-9 w-9 place-items-center rounded-[8px] text-white shadow-sm", f.tile)}>
                <f.icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-3 font-bold">{f.t}</h3>
              <p className="mt-1 text-sm text-mute">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const last = (lastId && channelMap.get(lastId)) || recentChannels[0] || null;
  const active = playlists.filter((p) => p.enabled).length;

  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-4 pb-24 sm:p-6 md:pb-6">
      {/* Héroe: continuar viendo (tarjeta oscura con degradado índigo) */}
      <section className="hero-bg relative shrink-0 overflow-hidden rounded-[10px] p-5 shadow-card sm:p-7 anim-fade-up">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent2/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand-teal/10 blur-3xl" />
        {last ? (
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <ChannelLogo name={last.name} logo={last.logo} className="h-28 w-44 shrink-0 rounded-[10px] border border-white/15 bg-white/10" imgClassName="p-3" />
            <div className="min-w-0 flex-1">
              <Badge className="bg-white/15 text-white">
                <SignalIcon className="h-3.5 w-3.5" /> Continuar viendo
              </Badge>
              <h1 className="mt-3 truncate text-2xl font-bold text-white sm:text-4xl">{last.name}</h1>
              <p className="mt-1 text-sm text-white/70">
                {last.category} · {names.get(last.playlistId)}
                {history[0] && history[0].id === last.id ? ` · ${timeAgo(history[0].playedAt)}` : ""}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" icon={PlayIcon} onClick={() => play(last.id)}>
                  Reproducir ahora
                </Button>
                <Button
                  size="lg"
                  icon={Squares2X2Icon}
                  className="border border-white/25 bg-white/10 text-white hover:bg-white/15"
                  onClick={() => navigate("/channels")}
                >
                  Explorar canales
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-start gap-4">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Todo listo para ver</h1>
            <p className="text-sm text-white/70">Elige un canal de tus listas para comenzar.</p>
            <Button variant="primary" icon={Squares2X2Icon} onClick={() => navigate("/channels")}>
              Explorar canales
            </Button>
          </div>
        )}
      </section>

      {/* Estadísticas */}
      <section className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Squares2X2Icon} tile="bg-accent" label="Canales" value={channels.length.toLocaleString("es-ES")} hint="Total importado" />
        <Stat icon={QueueListIcon} tile="bg-brand-yellow" label="Listas activas" value={`${active}/${playlists.length}`} hint="Habilitadas" />
        <Stat icon={HeartIcon} tile="bg-brand-pink" label="Favoritos" value={String(Object.keys(favorites).length)} />
        <Stat icon={ClockIcon} tile="bg-brand-teal" label="Reproducidos" value={String(history.length)} hint="Canales distintos" />
      </section>

      {/* Actividad + categorías */}
      <section className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        <div className="flex min-h-0 lg:col-span-2">
          <ActivityCard history={history} />
        </div>
        <CategoriesCard counts={catCounts} />
      </section>

      {/* Favoritos */}
      <section className="shrink-0">
        <SectionTitle
          icon={HeartIcon}
          title="Canales favoritos"
          action={favChannels.length > 0 && <Button variant="ghost" size="sm" onClick={() => navigate("/favorites")}>Ver todos</Button>}
        />
        {favChannels.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line bg-surface/50 px-4 py-6 text-sm text-mute">Marca canales con el corazón para tenerlos siempre a mano.</p>
        ) : (
          <Row>
            {favChannels.map((c) => (
              <div key={c.id} className="w-44 shrink-0 snap-start sm:w-52">
                <ChannelCard channel={c} listName={names.get(c.playlistId)} onPlay={play} />
              </div>
            ))}
          </Row>
        )}
      </section>

      {/* Recientes */}
      <section className="shrink-0">
        <SectionTitle
          icon={ClockIcon}
          title="Últimos reproducidos"
          action={recentChannels.length > 0 && <Button variant="ghost" size="sm" onClick={() => navigate("/recents")}>Ver historial</Button>}
        />
        {recentChannels.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line bg-surface/50 px-4 py-6 text-sm text-mute">Aquí aparecerán los canales que veas.</p>
        ) : (
          <Row>
            {recentChannels.map((c) => (
              <div key={c.id} className="w-44 shrink-0 snap-start sm:w-52">
                <ChannelCard channel={c} listName={names.get(c.playlistId)} onPlay={play} />
              </div>
            ))}
          </Row>
        )}
      </section>

      {/* Listas */}
      <section className="shrink-0">
        <SectionTitle icon={QueueListIcon} title="Listas importadas" action={<Button variant="ghost" size="sm" onClick={() => navigate("/playlists")}>Administrar</Button>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate("/playlists")}
              className="flex items-center gap-4 rounded-[10px] border border-line bg-surface p-4 text-left shadow-card transition-all duration-200 hover:border-accent/60 hover:shadow-card-hover"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-brand-yellow text-white shadow-sm">
                <QueueListIcon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{p.name}</span>
                <span className="block text-xs text-mute">
                  {p.channelCount.toLocaleString("es-ES")} canales · actualizada {timeAgo(p.updatedAt).toLowerCase()}
                </span>
              </span>
              <Badge className={p.enabled ? "bg-emerald-500/12 text-emerald-600" : "bg-ink/10 text-mute"}>{p.enabled ? "Activa" : "Inactiva"}</Badge>
            </button>
          ))}
        </div>
        {playlists.every((p) => !p.enabled) && (
          <EmptyState className="mt-4" icon={QueueListIcon} title="Todas tus listas están desactivadas" text="Activa al menos una lista para ver sus canales." />
        )}
      </section>
    </div>
  );
}
