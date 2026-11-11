import { useDeferredValue, useMemo, useState } from "react";
import {
  ListBulletIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  HeartIcon,
  Squares2X2Icon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ChannelCard, ChannelRow, VirtualChannels } from "@/components/ChannelViews";
import { EmptyState, Segmented, Select, Skeleton } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { navigate } from "@/lib/router";
import { usePlaylistNames, useStore, useVisibleChannels } from "@/lib/store";
import type { CategoryName } from "@/lib/types";
import { normalize } from "@/lib/utils";
import { cn } from "@/utils/cn";

export function ChannelsPage({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const ready = useStore((s) => s.ready);
  const playlists = useStore((s) => s.playlists);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const favorites = useStore((s) => s.favorites);
  const meta = useStore((s) => s.meta);
  const setMeta = useStore((s) => s.setMeta);
  const density = useStore((s) => s.settings.density);
  const play = useStore((s) => s.play);
  const visible = useVisibleChannels();
  const names = usePlaylistNames();

  const [category, setCategory] = useState<CategoryName | "all">("all");
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState<"default" | "az">("default");
  const deferredQuery = useDeferredValue(query);

  const base = useMemo(() => (favoritesOnly ? visible.filter((c) => favorites[c.id]) : visible), [visible, favorites, favoritesOnly]);

  // búsqueda instantánea: todos los términos deben aparecer en el índice normalizado
  const searched = useMemo(() => {
    const terms = normalize(deferredQuery).split(/\s+/).filter(Boolean);
    if (!terms.length) return base;
    return base.filter((c) => terms.every((t) => c._s.includes(t)));
  }, [base, deferredQuery]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of searched) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [searched]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const c of searched) if (c.group && (category === "all" || c.category === category)) set.add(c.group);
    return [...set].sort((a, b) => a.localeCompare(b, "es")).slice(0, 400);
  }, [searched, category]);

  const results = useMemo(() => {
    let list = searched;
    if (category !== "all") list = list.filter((c) => c.category === category);
    if (group !== "all") list = list.filter((c) => c.group === group);
    if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    return list;
  }, [searched, category, group, sort]);

  const minCard = density === "compact" ? 150 : density === "spacious" ? 240 : 190;
  const rowH = density === "compact" ? 52 : density === "spacious" ? 76 : 64;
  const title = favoritesOnly ? "Favoritos" : "Todos los canales";
  const activeCats = CATEGORIES.filter((c) => counts.get(c));

  if (!ready) {
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={QueueListIcon} title="Aún no hay canales" text="Importa una lista M3U/M3U8 desde una URL o un archivo para empezar a explorar tus canales.">
          <button onClick={() => navigate("/playlists")} className="inline-flex h-11 items-center gap-2 rounded-[8px] grad-primary px-5 text-sm font-semibold text-white shadow-md shadow-accent/25 hover:brightness-110">
            <PlusIcon className="h-5 w-5" /> Añadir lista
          </button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-3 pt-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-mute" aria-live="polite">
              {results.length.toLocaleString("es-ES")} {results.length === 1 ? "canal" : "canales"}
              {query && ` para «${query}»`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Filtrar por lista"
              value={meta.activePlaylist}
              onChange={(v) => setMeta({ activePlaylist: v })}
              className="h-9 w-40 text-xs sm:w-48"
              options={[{ value: "all", label: "Todas las listas" }, ...playlists.filter((p) => p.enabled).map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              label="Filtrar por grupo"
              value={group}
              onChange={setGroup}
              className="h-9 w-36 text-xs sm:w-44"
              options={[{ value: "all", label: "Todos los grupos" }, ...groups.map((g) => ({ value: g, label: g }))]}
            />
            <Select
              label="Ordenar"
              value={sort}
              onChange={(v) => setSort(v as "default" | "az")}
              className="h-9 w-32 text-xs"
              options={[
                { value: "default", label: "Orden de lista" },
                { value: "az", label: "A – Z" },
              ]}
            />
            <Segmented
              value={meta.viewMode}
              onChange={(v) => setMeta({ viewMode: v })}
              options={[
                { value: "grid", label: "Cuadrícula", icon: Squares2X2Icon },
                { value: "list", label: "Lista", icon: ListBulletIcon },
              ]}
            />
          </div>
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categorías">
          <Chip active={category === "all"} onClick={() => { setCategory("all"); setGroup("all"); }}>
            Todas <span className="opacity-60">{searched.length.toLocaleString("es-ES")}</span>
          </Chip>
          {activeCats.map((c) => (
            <Chip key={c} active={category === c} onClick={() => { setCategory(c); setGroup("all"); }}>
              {c} <span className="opacity-60">{(counts.get(c) ?? 0).toLocaleString("es-ES")}</span>
            </Chip>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={favoritesOnly && !query ? HeartIcon : MagnifyingGlassIcon}
            title={favoritesOnly && !query ? "Aún no tienes favoritos" : "Sin resultados"}
            text={
              favoritesOnly && !query
                ? "Pulsa el corazón en cualquier canal para guardarlo aquí."
                : "Prueba con otro término, categoría o lista. La búsqueda incluye nombre, grupo, categoría y tvg-id."
            }
          >
            {(query || category !== "all" || group !== "all") && (
              <button
                onClick={() => { setQuery(""); setCategory("all"); setGroup("all"); }}
                className="h-10 rounded-[8px] border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-accent/50"
              >
                Limpiar filtros
              </button>
            )}
            {favoritesOnly && !query && (
              <button onClick={() => navigate("/channels")} className="h-10 rounded-[8px] grad-primary px-4 text-sm font-semibold text-white shadow-md shadow-accent/25 hover:brightness-110">
                Explorar canales
              </button>
            )}
          </EmptyState>
        </div>
      ) : (
        <VirtualChannels
          key={meta.viewMode}
          items={results}
          mode={meta.viewMode}
          minCardWidth={minCard}
          rowHeight={rowH}
          className="min-h-0 flex-1 px-3 pb-24 sm:px-5 md:pb-6"
          renderItem={(c) =>
            meta.viewMode === "grid" ? (
              <ChannelCard channel={c} listName={names.get(c.playlistId)} onPlay={play} />
            ) : (
              <ChannelRow channel={c} listName={names.get(c.playlistId)} onPlay={play} compact={density === "compact"} />
            )
          }
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-all duration-200",
        active
          ? "border-transparent grad-primary text-white shadow-md shadow-accent/30"
          : "border-line bg-surface text-mute hover:border-accent/50 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
