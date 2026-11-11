import { useMemo, type ReactNode } from "react";
import {
  ArrowUpTrayIcon,
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
import { Badge, Button, EmptyState, SectionTitle, Skeleton, type IconType } from "@/components/ui";
import { navigate } from "@/lib/router";
import { usePlaylistNames, useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

function Stat({ icon: Icon, label, value, hint }: { icon: IconType; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-mute">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">{children}</div>;
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

  if (!ready) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-52" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  // ---- Primera ejecución / sin listas ----
  if (playlists.length === 0) {
    return (
      <div className="bg-aurora min-h-full p-4 sm:p-8">
        <div className="mx-auto max-w-3xl pt-6 text-center anim-fade-up">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-accent to-accent2 text-white shadow-2xl shadow-accent/40">
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

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { icon: ArrowUpTrayIcon, t: "Importa lo tuyo", d: "Desde una URL o un archivo local. Se guarda una copia, aunque la fuente desaparezca." },
            { icon: LockClosedIcon, t: "Privado por diseño", d: "Sin cuentas, sin telemetría. Tus listas nunca salen de tu navegador." },
            { icon: ShieldCheckIcon, t: "Responsabilidad", d: "Usa solo fuentes de contenido que tengas autorización para utilizar." },
          ].map((f, i) => (
            <div key={f.t} className="rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur anim-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <f.icon className="h-6 w-6 text-accent2" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
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
    <div className="mx-auto max-w-7xl space-y-8 p-4 pb-24 sm:p-6 md:pb-8">
      {/* Hero: continuar viendo */}
      <section className="bg-aurora relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-8 anim-fade-up">
        {last ? (
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <ChannelLogo name={last.name} logo={last.logo} className="h-28 w-44 shrink-0 rounded-2xl border border-line" imgClassName="p-3" />
            <div className="min-w-0 flex-1">
              <Badge className="bg-accent2/15 text-accent2">
                <SignalIcon className="h-3.5 w-3.5" /> Continuar viendo
              </Badge>
              <h1 className="mt-3 truncate text-2xl font-bold sm:text-4xl">{last.name}</h1>
              <p className="mt-1 text-sm text-mute">
                {last.category} · {names.get(last.playlistId)}
                {history[0] && history[0].id === last.id ? ` · ${timeAgo(history[0].playedAt)}` : ""}
              </p>
              <Button variant="primary" size="lg" icon={PlayIcon} className="mt-5" onClick={() => play(last.id)}>
                Reproducir ahora
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <h1 className="text-2xl font-bold sm:text-3xl">Todo listo para ver</h1>
            <p className="text-sm text-mute">Elige un canal de tus listas para comenzar.</p>
            <Button variant="primary" icon={Squares2X2Icon} onClick={() => navigate("/channels")}>
              Explorar canales
            </Button>
          </div>
        )}
      </section>

      {/* Estadísticas */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Squares2X2Icon} label="Canales" value={channels.length.toLocaleString("es-ES")} hint="Total importado" />
        <Stat icon={QueueListIcon} label="Listas activas" value={`${active}/${playlists.length}`} hint="Habilitadas" />
        <Stat icon={HeartIcon} label="Favoritos" value={String(Object.keys(favorites).length)} />
        <Stat icon={ClockIcon} label="Reproducidos" value={String(history.length)} hint="Canales distintos" />
      </section>

      {/* Favoritos */}
      <section>
        <SectionTitle icon={HeartIcon} title="Canales favoritos" action={favChannels.length > 0 && <Button variant="ghost" size="sm" onClick={() => navigate("/favorites")}>Ver todos</Button>} />
        {favChannels.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-mute">Marca canales con el corazón para tenerlos siempre a mano.</p>
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
      <section>
        <SectionTitle icon={ClockIcon} title="Últimos reproducidos" action={recentChannels.length > 0 && <Button variant="ghost" size="sm" onClick={() => navigate("/recents")}>Ver historial</Button>} />
        {recentChannels.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-mute">Aquí aparecerán los canales que veas.</p>
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
      <section>
        <SectionTitle icon={QueueListIcon} title="Listas importadas" action={<Button variant="ghost" size="sm" onClick={() => navigate("/playlists")}>Administrar</Button>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate("/playlists")}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-all duration-200 hover:border-accent/60"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/25 to-accent2/20 text-accent2">
                <QueueListIcon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-mute">
                  {p.channelCount.toLocaleString("es-ES")} canales · actualizada {timeAgo(p.updatedAt).toLowerCase()}
                </span>
              </span>
              <Badge className={p.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-ink/10 text-mute"}>{p.enabled ? "Activa" : "Inactiva"}</Badge>
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
