import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CircleStackIcon,
  ClockIcon,
  ComputerDesktopIcon,
  MoonIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Button, ConfirmButton, PageHeader, Segmented, Select, Toggle, type IconType } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Density, FullscreenMode, QualityPref, ThemeMode } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

function Section({ icon: Icon, title, desc, children }: { icon: IconType; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-2 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {desc && <p className="text-xs text-mute">{desc}</p>}
        </div>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0 max-w-md">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-mute">{desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.setSettings);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);
  const clearHistory = useStore((s) => s.clearHistory);
  const deleteAll = useStore((s) => s.deleteAllData);
  const nHistory = useStore((s) => s.history.length);

  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => undefined);
  }, [nHistory]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24 sm:p-6 md:pb-8">
      <PageHeader title="Configuración" subtitle="Todas las preferencias se guardan automáticamente en tu dispositivo." />

      <Section icon={SparklesIcon} title="Apariencia">
        <Row title="Tema" desc="El tema oscuro es el predeterminado.">
          <Segmented<ThemeMode>
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: "dark", label: "Oscuro", icon: MoonIcon },
              { value: "light", label: "Claro", icon: SunIcon },
              { value: "system", label: "Sistema", icon: ComputerDesktopIcon },
            ]}
          />
        </Row>
        <Row title="Densidad de tarjetas" desc="Tamaño de las tarjetas y filas del explorador.">
          <Segmented<Density>
            value={settings.density}
            onChange={(density) => set({ density })}
            options={[
              { value: "compact", label: "Compacta" },
              { value: "comfortable", label: "Cómoda" },
              { value: "spacious", label: "Amplia" },
            ]}
          />
        </Row>
        <Row title="Ocultar duplicados entre listas" desc="Si varias listas contienen la misma URL de canal, solo se muestra una vez.">
          <Toggle checked={settings.hideDuplicates} onChange={(hideDuplicates) => set({ hideDuplicates })} label="Ocultar duplicados" />
        </Row>
      </Section>

      <Section icon={PlayIcon} title="Reproductor">
        <Row title="Reproducción automática" desc="Empieza a reproducir al seleccionar un canal.">
          <Toggle checked={settings.autoplay} onChange={(autoplay) => set({ autoplay })} label="Reproducción automática" />
        </Row>
        <Row title="Silenciar al iniciar" desc="El canal comienza sin sonido al abrir el reproductor.">
          <Toggle checked={settings.startMuted} onChange={(startMuted) => set({ startMuted })} label="Silenciar al iniciar" />
        </Row>
        <Row title="Calidad preferida" desc="Solo aplica a flujos HLS con varias variantes.">
          <Select
            label="Calidad preferida"
            value={settings.preferredQuality}
            onChange={(v) => set({ preferredQuality: v as QualityPref })}
            options={[
              { value: "auto", label: "Automática" },
              { value: "highest", label: "La más alta" },
              { value: "1080", label: "Hasta 1080p" },
              { value: "720", label: "Hasta 720p" },
              { value: "480", label: "Hasta 480p" },
              { value: "360", label: "Hasta 360p" },
            ]}
          />
        </Row>
        <Row title="Reconexión automática" desc="Reintenta cuando el canal se corta o falla.">
          <Toggle checked={settings.autoReconnect} onChange={(autoReconnect) => set({ autoReconnect })} label="Reconexión automática" />
        </Row>
        {settings.autoReconnect && (
          <>
            <Row title="Tiempo entre reintentos">
              <Select
                label="Tiempo entre reintentos"
                value={String(settings.retryDelay)}
                onChange={(v) => set({ retryDelay: Number(v) })}
                options={[2, 4, 6, 10, 15, 30].map((n) => ({ value: String(n), label: `${n} segundos` }))}
              />
            </Row>
            <Row title="Intentos máximos">
              <Select
                label="Intentos máximos"
                value={String(settings.maxRetries)}
                onChange={(v) => set({ maxRetries: Number(v) })}
                options={[1, 3, 5, 10, 20].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "intento" : "intentos"}` }))}
              />
            </Row>
          </>
        )}
        <Row title="Pantalla completa" desc="«Reproductor» conserva los controles personalizados; «Vídeo» usa los controles del navegador.">
          <Segmented<FullscreenMode>
            value={settings.fullscreenMode}
            onChange={(fullscreenMode) => set({ fullscreenMode })}
            options={[
              { value: "container", label: "Reproductor" },
              { value: "video", label: "Solo vídeo" },
            ]}
          />
        </Row>
      </Section>

      <Section icon={CircleStackIcon} title="Datos" desc="Copias de seguridad en formato JSON y gestión del almacenamiento local.">
        <Row title="Exportar información" desc="Configuración, listas con sus canales, o una copia completa (incluye favoritos e historial).">
          <Button size="sm" icon={ArrowDownTrayIcon} onClick={() => void exportBackup("config")}>
            Configuración
          </Button>
          <Button size="sm" icon={ArrowDownTrayIcon} onClick={() => void exportBackup("playlists")}>
            Listas
          </Button>
          <Button size="sm" variant="primary" icon={ArrowDownTrayIcon} onClick={() => void exportBackup("full")}>
            Copia completa
          </Button>
        </Row>
        <Row title="Importar copia de seguridad" desc="Restaura listas, favoritos, historial y configuración desde un archivo JSON de NEXA IPTV.">
          <Button size="sm" icon={ArrowUpTrayIcon} onClick={() => fileRef.current?.click()}>
            Seleccionar archivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPending(f);
              e.target.value = "";
            }}
          />
        </Row>
        {pending && (
          <div className="my-3 rounded-2xl border border-accent/40 bg-accent/5 p-4 anim-fade-up">
            <p className="text-sm font-medium">Restaurar «{pending.name}»</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Segmented<"merge" | "replace">
                value={mode}
                onChange={setMode}
                options={[
                  { value: "merge", label: "Fusionar con mis datos" },
                  { value: "replace", label: "Reemplazar todo" },
                ]}
              />
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await importBackup(pending, mode === "replace");
                  setBusy(false);
                  setPending(null);
                }}
              >
                Restaurar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                Cancelar
              </Button>
            </div>
            {mode === "replace" && <p className="mt-2 text-xs text-amber-400">Se eliminarán antes todos los datos actuales.</p>}
          </div>
        )}
        <Row title="Limpiar historial" desc={`${nHistory} ${nHistory === 1 ? "entrada" : "entradas"} guardadas.`}>
          {nHistory > 0 ? <ConfirmButton label="Limpiar historial" icon={ClockIcon} onConfirm={() => void clearHistory()} confirmLabel="Limpiar" /> : <span className="text-xs text-mute">Historial vacío</span>}
        </Row>
        <Row title="Eliminar todos los datos" desc="Borra listas, canales, favoritos, historial y ajustes. No se puede deshacer.">
          <ConfirmButton label="Eliminar todo" icon={TrashIcon} onConfirm={() => void deleteAll()} confirmLabel="Eliminar todo" />
        </Row>
        {usage && (
          <Row title="Almacenamiento utilizado" desc="Estimación del navegador para este sitio.">
            <span className="text-sm tabular-nums text-mute">
              {formatBytes(usage.used)} {usage.quota ? `de ${formatBytes(usage.quota)}` : ""}
            </span>
          </Row>
        )}
      </Section>

      <Section icon={ShieldCheckIcon} title="Privacidad y uso responsable">
        <div className="space-y-2 py-4 text-sm text-mute">
          <p>NEXA IPTV funciona íntegramente en tu navegador: no hay cuentas, telemetría ni servidores propios. Tus listas se guardan solo en IndexedDB de este dispositivo.</p>
          <p>La aplicación no incluye canales ni contenido. Eres responsable de utilizar únicamente fuentes que tengas autorización para reproducir.</p>
        </div>
      </Section>
    </div>
  );
}
