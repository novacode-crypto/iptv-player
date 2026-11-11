import { useMemo, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ChannelLogo, ChannelRow, FavoriteButton, StatusDot, VirtualChannels } from "@/components/ChannelViews";
import { Badge } from "@/components/ui";
import { navigate } from "@/lib/router";
import { usePlaylistNames, useStore, useVisibleChannels } from "@/lib/store";
import type { Channel } from "@/lib/types";
import { Player } from "@/player/Player";
import { cn } from "@/utils/cn";

type Tab = "category" | "favorites" | "recent";

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function WatchPage() {
  const currentId = useStore((s) => s.currentChannelId);
  const channelMap = useStore((s) => s.channelMap);
  const favorites = useStore((s) => s.favorites);
  const history = useStore((s) => s.history);
  const play = useStore((s) => s.play);
  const visible = useVisibleChannels();
  const names = usePlaylistNames();
  const [tab, setTab] = useState<Tab>("category");

  const channel = (currentId && channelMap.get(currentId)) || null;

  const queue = useMemo<Channel[]>(() => {
    if (tab === "favorites") return visible.filter((c) => favorites[c.id]);
    if (tab === "recent") {
      const vis = new Set(visible.map((c) => c.id));
      return history.map((h) => channelMap.get(h.id)).filter((c): c is NonNullable<typeof c> => !!c && vis.has(c.id));
    }
    return channel ? visible.filter((c) => c.category === channel.category) : visible;
  }, [tab, visible, favorites, history, channelMap, channel]);

  const step = (dir: 1 | -1) => {
    if (!queue.length) return;
    const i = queue.findIndex((c) => c.id === channel?.id);
    const next = i === -1 ? queue[0] : queue[(i + dir + queue.length) % queue.length];
    if (next && next.id !== channel?.id) play(next.id);
  };

  const canStep = queue.length > 1 || (queue.length === 1 && queue[0].id !== channel?.id);

  return (
    <div className="mx-auto grid max-w-[1700px] gap-4 p-0 pb-20 sm:p-4 md:pb-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Player
          channel={channel}
          onNext={canStep ? () => step(1) : undefined}
          onPrev={canStep ? () => step(-1) : undefined}
          className="aspect-video max-h-[74vh] sm:rounded-[10px] sm:shadow-card"
        />

        {channel ? (
          <div className="mx-4 flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-surface p-4 shadow-card sm:mx-0 anim-fade-up">
            <ChannelLogo name={channel.name} logo={channel.logo} className="h-16 w-24 shrink-0 rounded-[8px] border border-line" imgClassName="p-2" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold">{channel.name}</h1>
                <StatusDot id={channel.id} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <Badge>{channel.category}</Badge>
                {channel.group && channel.group !== channel.category && <Badge className="bg-ink/10 text-mute">{channel.group}</Badge>}
                {channel.language && <Badge className="bg-ink/10 text-mute">{channel.language}</Badge>}
                {channel.country && <Badge className="bg-ink/10 text-mute">{channel.country}</Badge>}
              </div>
              <p className="mt-2 truncate text-xs text-mute">
                Lista: {names.get(channel.playlistId)} · Origen: {hostOf(channel.url)}
                {channel.tvgId ? ` · tvg-id: ${channel.tvgId}` : ""}
              </p>
            </div>
            <FavoriteButton id={channel.id} className="h-10 w-10 bg-surface2! text-mute" />
          </div>
        ) : (
          <div className="mx-4 rounded-[10px] border border-dashed border-line bg-surface/60 p-8 text-center sm:mx-0">
            <p className="font-bold">No hay ningún canal seleccionado</p>
            <p className="mt-1 text-sm text-mute">Elige uno de la lista lateral o explora tus canales.</p>
            <button onClick={() => navigate("/channels")} className="mt-4 inline-flex h-10 items-center gap-2 rounded-[8px] grad-primary px-4 text-sm font-semibold text-white shadow-md shadow-accent/25 hover:brightness-110">
              <ArrowLeftIcon className="h-5 w-5" /> Explorar canales
            </button>
          </div>
        )}
      </div>

      <aside className="mx-4 flex h-[60vh] min-h-0 flex-col rounded-[10px] border border-line bg-surface shadow-card sm:mx-0 lg:h-[calc(100vh-7rem)]" aria-label="Más canales">
        <div className="flex gap-1 border-b border-line p-2" role="tablist">
          {(
            [
              ["category", channel ? channel.category : "Categoría"],
              ["favorites", "Favoritos"],
              ["recent", "Recientes"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "h-9 flex-1 truncate rounded-[8px] px-2 text-xs font-semibold transition-all",
                tab === t
                  ? "grad-primary text-white shadow-sm shadow-accent/30"
                  : "text-mute hover:bg-surface2 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {queue.length === 0 ? (
          <p className="p-6 text-center text-sm text-mute">{tab === "favorites" ? "No tienes favoritos en las listas activas." : tab === "recent" ? "Aún no hay historial." : "No hay más canales."}</p>
        ) : (
          <VirtualChannels
            items={queue}
            mode="list"
            rowHeight={56}
            gap={6}
            className="min-h-0 flex-1 px-2 py-2"
            renderItem={(c) => <ChannelRow channel={c} listName={names.get(c.playlistId)} onPlay={play} highlight={c.id === channel?.id} compact />}
          />
        )}
      </aside>
    </div>
  );
}
