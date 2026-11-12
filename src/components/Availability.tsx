import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, SignalIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, Modal } from "@/components/ui";
import { probeMany, type ProbeResult } from "@/lib/availability";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";
import { cn } from "@/utils/cn";

type Phase = "running" | "done" | "confirm" | "removing";

const n = (v: number) => v.toLocaleString("es-ES");

function Stat({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[10px] border p-3.5", ok ? "border-emerald-500/30 bg-emerald-500/8" : warn ? "border-red-500/30 bg-red-500/8" : "border-line bg-surface2")}>
      {children}
    </div>
  );
}

function ResultRow({ r }: { r: ProbeResult }) {
  return (
    <li className="flex items-center gap-2.5 rounded-[8px] bg-surface2/60 px-3 py-2 text-sm anim-fade-up">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", r.ok ? "bg-emerald-500" : "bg-red-500")} />
      <span className="min-w-0 flex-1 truncate" title={r.name}>{r.name}</span>
      <span className={cn("shrink-0 text-[11px]", r.ok ? "text-mute" : "font-medium text-red-500")}>{r.ok ? `${r.ms} ms` : r.reason}</span>
    </li>
  );
}

/**
 * Comprobador de disponibilidad de streams. Arranca solo al abrirse, informa
 * del avance en vivo y, al terminar, ofrece eliminar los canales caídos tras
 * una confirmación con diálogo propio de la app.
 */
export function AvailabilityModal({ open, channels, onClose }: { open: boolean; channels: Channel[]; onClose: () => void }) {
  const removeChannels = useStore((s) => s.removeChannels);
  const markStatus = useStore((s) => s.markStatus);
  const [phase, setPhase] = useState<Phase>("running");
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [total, setTotal] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [runId, setRunId] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  useEffect(() => {
    if (!open) return;
    const list = channelsRef.current;
    setTotal(list.length);
    setResults([]);
    setStopped(false);
    setPhase("running");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let alive = true;
    if (list.length) {
      void probeMany(list, {
        timeoutMs: 9000,
        concurrency: 6,
        signal: ctrl.signal,
        onResult: (r) => {
          if (!alive) return;
          markStatus(r.id, r.ok);
          setResults((prev) => [...prev, r]);
        },
      }).then((run) => {
        if (!alive) return;
        setStopped(run.cancelled);
        setPhase("done");
      });
    } else {
      setPhase("done");
    }
    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId, markStatus]);

  const done = results.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const okCount = results.reduce((s, r) => s + (r.ok ? 1 : 0), 0);
  const offline = useMemo(() => results.filter((r) => !r.ok), [results]);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };
  const rerun = () => {
    abortRef.current?.abort();
    setRunId((x) => x + 1);
  };
  const doRemove = async () => {
    setPhase("removing");
    await removeChannels(offline.map((r) => r.id));
    onClose();
  };

  const title =
    phase === "confirm" ? "Eliminar canales no disponibles" : phase === "removing" ? "Eliminando canales…" : "Comprobación de streams";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      icon={phase === "confirm" ? ExclamationTriangleIcon : SignalIcon}
      tile={phase === "confirm" ? "bg-red-500" : "bg-brand-teal"}
      title={title}
      subtitle={
        phase === "running"
          ? `${n(done)} de ${n(total)} canales comprobados · verifico cada stream tal como lo haría el reproductor`
          : `${n(total)} canales en la comprobación`
      }
      footer={
        phase === "running" ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleClose}>Cerrar</Button>
            <Button variant="secondary" size="sm" icon={ExclamationTriangleIcon} onClick={() => abortRef.current?.abort()}>
              Detener comprobación
            </Button>
          </>
        ) : phase === "done" ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleClose}>Cerrar</Button>
            <Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={rerun}>Volver a comprobar</Button>
            {offline.length > 0 && (
              <Button variant="danger" size="sm" icon={TrashIcon} onClick={() => setPhase("confirm")}>
                Eliminar {n(offline.length)} no disponibles
              </Button>
            )}
          </>
        ) : phase === "confirm" ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setPhase("done")}>Cancelar</Button>
            <Button variant="danger" size="sm" icon={TrashIcon} onClick={() => void doRemove()}>
              Eliminar {n(offline.length)} {offline.length === 1 ? "canal" : "canales"}
            </Button>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-mute">Eliminando canales de tus listas…</span>
        )
      }
    >
      {phase === "running" && (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-mute">
              <span>{n(done)} / {n(total)}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full grad-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat ok>
              <p className="text-2xl font-extrabold tabular-nums leading-none text-emerald-600">{n(okCount)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">Disponibles</p>
            </Stat>
            <Stat warn>
              <p className="text-2xl font-extrabold tabular-nums leading-none text-red-500">{n(offline.length)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">No disponibles</p>
            </Stat>
            <Stat>
              <p className="text-2xl font-extrabold tabular-nums leading-none">{n(total - done)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">Pendientes</p>
            </Stat>
          </div>
          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
            {results.slice(-30).reverse().map((r) => (
              <ResultRow key={r.id} r={r} />
            ))}
          </ul>
          {total > 1200 && (
            <p className="text-xs text-mute">
              Con listas muy grandes la comprobación puede tardar varios minutos (9 s como máximo por canal). Puedes detenerla cuando quieras.
            </p>
          )}
        </div>
      )}

      {phase === "done" && total === 0 && (
        <p className="py-4 text-center text-sm text-mute">No hay canales que comprobar con los filtros actuales.</p>
      )}

      {phase === "done" && total > 0 && (
        <div className="space-y-4">
          {stopped && (
            <p className="flex items-start gap-2 rounded-[10px] border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm text-amber-600">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              Comprobación detenida: se revisaron {n(done)} de {n(total)} canales. «Volver a comprobar» reinicia el proceso.
            </p>
          )}
          <div className={cn("grid gap-3", stopped ? "grid-cols-3" : "grid-cols-2")}>
            <Stat ok>
              <p className="text-2xl font-extrabold tabular-nums leading-none text-emerald-600">{n(okCount)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">Disponibles</p>
            </Stat>
            <Stat warn={offline.length > 0}>
              <p className="text-2xl font-extrabold tabular-nums leading-none text-red-500">{n(offline.length)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">No disponibles</p>
            </Stat>
            {stopped && (
              <Stat>
                <p className="text-2xl font-extrabold tabular-nums leading-none">{n(total - done)}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">Sin comprobar</p>
              </Stat>
            )}
          </div>
          {offline.length === 0 ? (
            <p className="flex items-start gap-2.5 rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              {stopped
                ? "Todos los canales comprobados responden correctamente."
                : `Todos los canales responden correctamente. Ningún stream está caído.`}
            </p>
          ) : (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Canales no disponibles ({n(offline.length)})</p>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {offline.slice(0, 200).map((r) => (
                  <ResultRow key={r.id} r={r} />
                ))}
              </ul>
              {offline.length > 200 && <p className="mt-2 text-xs text-mute">…y {n(offline.length - 200)} más.</p>}
            </div>
          )}
        </div>
      )}

      {phase === "confirm" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[10px] border border-red-500/30 bg-red-500/10 p-4">
            <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-red-500" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-red-500">Se eliminarán {n(offline.length)} {offline.length === 1 ? "canal" : "canales"} de tus listas</p>
              <p className="mt-1 text-mute">
                También se quitarán de favoritos e historial. Si reimportas o actualizas la lista, los canales volverán a aparecer.
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Canales que se eliminarán</p>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {offline.slice(0, 8).map((r) => (
                <ResultRow key={r.id} r={r} />
              ))}
              {offline.length > 8 && <li className="px-3 text-xs text-mute">…y {n(offline.length - 8)} más</li>}
            </ul>
          </div>
        </div>
      )}

      {phase === "removing" && (
        <p className="py-4 text-center text-sm text-mute">Quitando los canales caídos de tus listas y de tu historial…</p>
      )}
    </Modal>
  );
}
