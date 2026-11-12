import { useRef, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CheckIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LinkIcon,
  PencilSquareIcon,
  PlusIcon,
  QueueListIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Badge, Button, ConfirmButton, EmptyState, IconButton, PageHeader, Segmented, Spinner, Toggle } from "@/components/ui";
import { MAX_BYTES, validateUrl } from "@/lib/playlist-manager";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import type { ImportJob, Playlist } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { cn } from "@/utils/cn";

function AddPanel({ onClose }: { onClose: () => void }) {
  const importMany = useStore((s) => s.importMany);
  const [mode, setMode] = useState<"url" | "file">("url");
  const [urls, setUrls] = useState("");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | File[]) => {
    const next = [...files];
    const errs: string[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) errs.push(`«${f.name}» supera 150 MB.`);
      else if (f.size === 0) errs.push(`«${f.name}» está vacío.`);
      else if (!/\.(m3u8?|txt)$/i.test(f.name) && f.type && !f.type.startsWith("text/") && !f.type.includes("mpegurl")) {
        errs.push(`«${f.name}» no parece una lista M3U.`);
      } else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    setErrors(errs);
  };

  const submit = () => {
    if (mode === "url") {
      const lines = [...new Set(urls.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
      if (!lines.length) return setErrors(["Introduce al menos una URL."]);
      const errs = lines.map((l) => ({ l, e: validateUrl(l) })).filter((x) => x.e).map((x) => `${x.l.slice(0, 60)}: ${x.e}`);
      if (errs.length) return setErrors(errs);
      void importMany(lines.map((url) => ({ kind: "url" as const, url, name: lines.length === 1 ? name : undefined })));
    } else {
      if (!files.length) return setErrors(["Selecciona al menos un archivo."]);
      void importMany(files.map((file) => ({ kind: "file" as const, file, name: files.length === 1 ? name : undefined })));
    }
    setUrls("");
    setName("");
    setFiles([]);
    setErrors([]);
    onClose();
  };

  const count = mode === "url" ? urls.split(/\r?\n/).filter((l) => l.trim()).length : files.length;

  return (
    <section className="mb-6 shrink-0 rounded-[10px] border border-accent/40 bg-surface p-5 shadow-card anim-fade-up" aria-label="Añadir lista">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Añadir lista IPTV</h2>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrors([]);
          }}
          options={[
            { value: "url", label: "Desde URL", icon: LinkIcon },
            { value: "file", label: "Archivo local", icon: DocumentArrowUpIcon },
          ]}
        />
      </div>

      {mode === "url" ? (
        <div>
          <label htmlFor="urls" className="mb-1.5 block text-sm text-mute">
            URL(s) M3U / M3U8 — una por línea para importar varias a la vez
          </label>
          <textarea
            id="urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="https://ejemplo.com/mi-lista.m3u"
            className="w-full resize-y rounded-[8px] border border-line bg-surface2 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-mute/60 focus:border-accent"
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-mute">
            <InformationCircleIcon className="mt-px h-4 w-4 shrink-0" />
            El servidor de la lista debe permitir CORS. Si falla, descarga el archivo y súbelo en «Archivo local».
          </p>
        </div>
      ) : (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed px-4 py-8 text-center transition-colors",
              drag ? "border-accent bg-accent/10" : "border-line hover:border-accent/60",
            )}
          >
            <DocumentArrowUpIcon className="h-9 w-9 text-accent2" />
            <p className="mt-2 text-sm font-medium">Arrastra archivos .m3u / .m3u8 o haz clic para seleccionarlos</p>
            <p className="text-xs text-mute">Puedes elegir varios a la vez · máx. 150 MB por archivo</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/vnd.apple.mpegurl,application/x-mpegurl,text/plain"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f) => (
                <li key={f.name + f.size} className="flex items-center gap-2 rounded-[8px] bg-surface2 px-3 py-2 text-sm">
                  <DocumentArrowUpIcon className="h-4 w-4 shrink-0 text-mute" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-mute">{formatBytes(f.size)}</span>
                  <IconButton icon={XMarkIcon} label="Quitar archivo" className="h-6 w-6" onClick={() => setFiles(files.filter((x) => x !== f))} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="pl-name" className="mb-1.5 block text-sm text-mute">
          Nombre personalizado {count > 1 && <span className="text-xs">(solo disponible al importar una lista)</span>}
        </label>
        <input
          id="pl-name"
          value={name}
          disabled={count > 1}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Opcional: p. ej. «Mi lista de casa»"
          className="h-10 w-full rounded-[8px] border border-line bg-surface2 px-3 text-sm outline-none placeholder:text-mute/60 focus:border-accent disabled:opacity-50"
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-[8px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500" role="alert">
          {errors.map((e, i) => (
            <li key={i} className="flex items-start gap-2">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-mute">Importa únicamente contenido que tengas autorización para utilizar. NEXA IPTV no incluye ni proporciona canales.</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={CheckIcon} onClick={submit}>
            Importar{count > 1 ? ` ${count} listas` : ""}
          </Button>
        </div>
      </div>
    </section>
  );
}

function JobRow({ job }: { job: ImportJob }) {
  const dismiss = useStore((s) => s.dismissJob);
  const running = job.stage === "reading" || job.stage === "parsing" || job.stage === "saving";
  const stageLabel = { reading: "Descargando", parsing: "Analizando", saving: "Guardando", done: "Completado", error: "Error", duplicate: "Duplicada" }[job.stage];
  const Icon = job.stage === "done" ? CheckCircleIcon : job.stage === "duplicate" ? InformationCircleIcon : ExclamationTriangleIcon;
  return (
    <li className="rounded-[8px] border border-line bg-surface p-3.5 shadow-xs anim-fade-up" aria-live="polite">
      <div className="flex items-center gap-3">
        {running ? (
          <Spinner className="h-5 w-5 shrink-0 text-accent2" />
        ) : (
          <Icon className={cn("h-5 w-5 shrink-0", job.stage === "done" && "text-emerald-500", job.stage === "duplicate" && "text-accent2", job.stage === "error" && "text-red-500")} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.label}</p>
          <p className={cn("text-xs", job.stage === "error" ? "text-red-500" : "text-mute")}>
            {running ? `${stageLabel} · ${job.message}` : job.message}
          </p>
        </div>
        {!running && <IconButton icon={XMarkIcon} label="Descartar" className="h-7 w-7" onClick={() => dismiss(job.id)} />}
      </div>
      {running && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full grad-primary transition-all duration-300"
            style={job.progress > 0 ? { width: `${Math.max(4, job.progress * 100)}%` } : undefined}
          />
        </div>
      )}
    </li>
  );
}

function PlaylistCard({ p }: { p: Playlist }) {
  const toggle = useStore((s) => s.toggleList);
  const rename = useStore((s) => s.renameList);
  const update = useStore((s) => s.updateList);
  const remove = useStore((s) => s.deleteList);
  const setMeta = useStore((s) => s.setMeta);
  const updating = useStore((s) => s.jobs.some((j) => j.label === `Actualizando ${p.name}` && (j.stage === "reading" || j.stage === "parsing" || j.stage === "saving")));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const v = draft.trim();
    if (v && v !== p.name) void rename(p.id, v);
    setEditing(false);
  };

  return (
    <article className={cn("flex flex-col rounded-[10px] border bg-surface p-5 shadow-card transition-all duration-200 anim-fade-up", p.enabled ? "border-line hover:border-accent/50 hover:shadow-card-hover" : "border-line opacity-70")}>
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-brand-yellow text-white shadow-sm">
          <QueueListIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={draft}
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
                aria-label="Nombre de la lista"
                className="h-9 min-w-0 flex-1 rounded-lg border border-accent bg-bg px-2.5 text-sm outline-none"
              />
              <IconButton icon={CheckIcon} label="Guardar nombre" type="submit" className="text-emerald-400" />
            </form>
          ) : (
            <h3 className="truncate text-lg font-semibold" title={p.name}>
              {p.name}
            </h3>
          )}
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-mute" title={p.source}>
            {p.sourceType === "url" ? <LinkIcon className="h-3.5 w-3.5 shrink-0" /> : <DocumentArrowUpIcon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{p.source}</span>
          </p>
        </div>
        <Toggle checked={p.enabled} onChange={() => void toggle(p.id)} label={p.enabled ? "Desactivar lista" : "Activar lista"} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[8px] bg-surface2 p-3">
          <dt className="text-xs text-mute">Canales</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums">{p.channelCount.toLocaleString("es-ES")}</dd>
        </div>
        <div className="rounded-[8px] bg-surface2 p-3">
          <dt className="text-xs text-mute">Última actualización</dt>
          <dd className="mt-0.5 text-xs font-medium leading-tight">{formatDate(p.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 mb-4 flex flex-wrap items-center gap-1.5">
        <Badge className={p.enabled ? "bg-emerald-500/12 text-emerald-600" : "bg-ink/10 text-mute"}>{p.enabled ? "Activa" : "Desactivada"}</Badge>
        <Badge className="bg-ink/10 text-mute">Copia local</Badge>
        {p.duplicatesRemoved > 0 && <Badge className="bg-amber-500/12 text-amber-600">{p.duplicatesRemoved} duplicados omitidos</Badge>}
        {p.lastError && (
          <Badge className="bg-red-500/15 text-red-400" >
            Última actualización fallida
          </Badge>
        )}
      </div>
      {p.lastError && <p className="mt-2 mb-4 text-xs text-red-500">{p.lastError}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-line pt-3">
        <Button
          size="sm"
          variant="secondary"
          icon={Squares2X2Icon}
          disabled={!p.enabled}
          onClick={() => {
            setMeta({ activePlaylist: p.id });
            navigate("/channels");
          }}
        >
          Ver canales
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={ArrowPathIcon}
          loading={updating}
          onClick={() => (p.sourceType === "url" ? void update(p.id) : fileRef.current?.click())}
          title={p.sourceType === "url" ? "Actualizar desde la URL original" : "Reemplazar desde un archivo"}
        >
          {updating ? "Actualizando" : p.sourceType === "url" ? "Actualizar" : "Reemplazar"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".m3u,.m3u8,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void update(p.id, f);
            e.target.value = "";
          }}
        />
        <span className="flex-1" />
        <IconButton
          icon={PencilSquareIcon}
          label="Editar nombre"
          onClick={() => {
            setDraft(p.name);
            setEditing(true);
          }}
        />
        <ConfirmButton label="Eliminar lista" icon={TrashIcon} iconOnly onConfirm={() => void remove(p.id)} confirmLabel="Eliminar" />
      </div>
    </article>
  );
}

export function PlaylistsPage() {
  const playlists = useStore((s) => s.playlists);
  const jobs = useStore((s) => s.jobs);
  const clearJobs = useStore((s) => s.clearJobs);
  const importDemo = useStore((s) => s.importDemo);
  const ready = useStore((s) => s.ready);
  const [adding, setAdding] = useState(false);
  const showAdd = adding || (ready && playlists.length === 0 && jobs.length === 0);

  return (
    <div className="flex w-full flex-1 flex-col p-4 pb-24 sm:p-6 md:pb-8">
      <PageHeader title="Listas IPTV" subtitle="Administra tus fuentes. Cada lista se guarda como copia local en tu dispositivo.">
        {!showAdd && (
          <Button variant="primary" icon={PlusIcon} onClick={() => setAdding(true)}>
            Añadir lista
          </Button>
        )}
      </PageHeader>

      {showAdd && <AddPanel onClose={() => setAdding(false)} />}

      {jobs.length > 0 && (
        <section className="mb-6 shrink-0" aria-label="Importaciones">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-mute">Actividad de importación</h2>
            <Button size="sm" variant="ghost" onClick={clearJobs}>
              Limpiar finalizadas
            </Button>
          </div>
          <ul className="space-y-2">
            {jobs.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </ul>
        </section>
      )}

      {playlists.length === 0 ? (
        !showAdd && (
          <EmptyState className="flex-1" icon={QueueListIcon} title="No hay listas importadas" text="Añade una lista M3U/M3U8 para comenzar.">
            <Button variant="primary" icon={PlusIcon} onClick={() => setAdding(true)}>
              Añadir lista
            </Button>
          </EmptyState>
        )
      ) : (
        <div className="grid flex-1 content-stretch gap-4 md:auto-rows-fr md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {playlists.map((p) => (
            <PlaylistCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {playlists.length === 0 && showAdd && (
        <div className="mt-4 text-center">
          <Button variant="ghost" icon={SparklesIcon} onClick={() => void importDemo()}>
            O prueba con la lista de demostración
          </Button>
        </div>
      )}
    </div>
  );
}
