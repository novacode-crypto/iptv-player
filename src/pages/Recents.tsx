import { useMemo } from "react";
import { ClockIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ChannelLogo } from "@/components/ChannelViews";
import { ConfirmButton, EmptyState, IconButton, PageHeader } from "@/components/ui";
import { navigate } from "@/lib/router";
import { usePlaylistNames, useStore } from "@/lib/store";
import { formatDate, timeAgo } from "@/lib/utils";

export function RecentsPage() {
  const history = useStore((s) => s.history);
  const channelMap = useStore((s) => s.channelMap);
  const play = useStore((s) => s.play);
  const remove = useStore((s) => s.removeHistory);
  const clear = useStore((s) => s.clearHistory);
  const names = usePlaylistNames();

  const items = useMemo(() => history.map((h) => ({ h, ch: channelMap.get(h.id) })), [history, channelMap]);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader title="Recientes" subtitle="Tu historial de reproducción, del más reciente al más antiguo.">
        {items.length > 0 && <ConfirmButton label="Limpiar historial" icon={TrashIcon} onConfirm={clear} confirmLabel="Limpiar" />}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState icon={ClockIcon} title="Todavía no has visto nada" text="Los canales que reproduzcas aparecerán aquí con la fecha y hora de su última reproducción.">
          <button onClick={() => navigate("/channels")} className="h-10 rounded-[8px] grad-primary px-4 text-sm font-semibold text-white shadow-md shadow-accent/25 hover:brightness-110">
            Explorar canales
          </button>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map(({ h, ch }) => (
            <li
              key={h.id}
              className="group flex items-center gap-3 rounded-[10px] border border-line bg-surface p-3 shadow-xs transition-all duration-200 hover:border-accent/50 hover:shadow-card anim-fade-up"
            >
              <button
                disabled={!ch}
                onClick={() => ch && play(ch.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
              >
                <ChannelLogo name={h.name} logo={ch?.logo ?? h.logo} className="h-12 w-[72px] shrink-0 rounded-[8px]" imgClassName="p-1.5" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.name}</p>
                  <p className="truncate text-xs text-mute">
                    {ch ? `${ch.category} · ${names.get(ch.playlistId) ?? ""}` : "Canal no disponible en tus listas"}
                  </p>
                  <p className="mt-0.5 text-xs text-mute" title={formatDate(h.playedAt)}>
                    {timeAgo(h.playedAt)} · {formatDate(h.playedAt)}
                    {h.count > 1 ? ` · ${h.count} reproducciones` : ""}
                  </p>
                </div>
              </button>
              <IconButton icon={XMarkIcon} label="Quitar del historial" onClick={() => remove(h.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
