export type CategoryName =
  | "Noticias"
  | "Deportes"
  | "Entretenimiento"
  | "Películas"
  | "Series"
  | "Infantiles"
  | "Música"
  | "Documentales"
  | "Internacionales"
  | "Otros";

export interface Channel {
  /** `${playlistId}:${hash}` — estable entre actualizaciones de la lista */
  id: string;
  playlistId: string;
  name: string;
  /** tvg-name cuando difiere del nombre mostrado */
  altName: string;
  tvgId: string;
  logo: string;
  /** group-title original, sin modificar */
  group: string;
  /** Categoría normalizada derivada del grupo */
  category: CategoryName;
  language: string;
  country: string;
  url: string;
  order: number;
}

/** Canal en memoria con índice de búsqueda precalculado */
export interface IndexedChannel extends Channel {
  _s: string;
}

export interface Playlist {
  id: string;
  name: string;
  sourceType: "url" | "file";
  /** URL de origen (o nombre de archivo para listas locales) */
  source: string;
  enabled: boolean;
  importedAt: number;
  updatedAt: number;
  channelCount: number;
  /** huella del contenido para detectar duplicados */
  contentHash: string;
  duplicatesRemoved: number;
  lastError?: string;
}

export interface FavoriteEntry {
  id: string; // channel id
  addedAt: number;
}

export interface HistoryEntry {
  id: string; // channel id
  playedAt: number;
  count: number;
  name: string;
  logo: string;
}

export interface StatusEntry {
  id: string;
  ok: boolean;
  at: number;
}

export type ThemeMode = "dark" | "light" | "system";
export type Density = "compact" | "comfortable" | "spacious";
export type QualityPref = "auto" | "highest" | "1080" | "720" | "480" | "360";
export type FullscreenMode = "container" | "video";
export type AspectMode = "auto" | "16:9" | "4:3" | "cover" | "stretch";

export interface Settings {
  theme: ThemeMode;
  density: Density;
  autoplay: boolean;
  startMuted: boolean;
  preferredQuality: QualityPref;
  autoReconnect: boolean;
  retryDelay: number; // segundos
  maxRetries: number;
  fullscreenMode: FullscreenMode;
  volume: number; // 0..1
  aspect: AspectMode;
  hideDuplicates: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  density: "comfortable",
  autoplay: true,
  startMuted: false,
  preferredQuality: "auto",
  autoReconnect: true,
  retryDelay: 4,
  maxRetries: 5,
  fullscreenMode: "container",
  volume: 0.8,
  aspect: "auto",
  hideDuplicates: false,
};

export interface Meta {
  lastChannelId: string | null;
  sidebarCollapsed: boolean;
  viewMode: "grid" | "list";
  activePlaylist: string; // "all" o id
  firstRunDone: boolean;
}

export const DEFAULT_META: Meta = {
  lastChannelId: null,
  sidebarCollapsed: false,
  viewMode: "grid",
  activePlaylist: "all",
  firstRunDone: false,
};

export interface ImportJob {
  id: string;
  label: string;
  stage: "reading" | "parsing" | "saving" | "done" | "error" | "duplicate";
  progress: number; // 0..1
  message: string;
  channels?: number;
}

export interface BackupFile {
  app: "NEXA IPTV";
  version: 1;
  kind: "config" | "playlists" | "full";
  exportedAt: number;
  settings?: Settings;
  meta?: Meta;
  playlists?: Playlist[];
  channels?: Channel[];
  favorites?: FavoriteEntry[];
  history?: HistoryEntry[];
  status?: StatusEntry[];
}
