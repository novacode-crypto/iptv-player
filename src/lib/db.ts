import type {
  Channel,
  FavoriteEntry,
  HistoryEntry,
  Playlist,
  StatusEntry,
} from "./types";

const DB_NAME = "nexa-iptv";
const DB_VERSION = 1;

export type StoreName =
  | "playlists"
  | "channels"
  | "favorites"
  | "history"
  | "status"
  | "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("playlists")) db.createObjectStore("playlists", { keyPath: "id" });
      if (!db.objectStoreNames.contains("channels")) {
        const s = db.createObjectStore("channels", { keyPath: "id" });
        s.createIndex("playlistId", "playlistId", { unique: false });
      }
      if (!db.objectStoreNames.contains("favorites")) db.createObjectStore("favorites", { keyPath: "id" });
      if (!db.objectStoreNames.contains("history")) {
        const s = db.createObjectStore("history", { keyPath: "id" });
        s.createIndex("playedAt", "playedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("status")) db.createObjectStore("status", { keyPath: "id" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("No se pudo abrir la base de datos."));
    };
    req.onblocked = () => reject(new Error("La base de datos está bloqueada por otra pestaña."));
  });
  return dbPromise;
}

export function describeDbError(err: unknown): string {
  const e = err as DOMException | undefined;
  if (e?.name === "QuotaExceededError") {
    return "Almacenamiento lleno. Elimina listas que no uses e inténtalo de nuevo.";
  }
  return e?.message || "Error de almacenamiento local.";
}

async function run<T = void>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => IDBRequest | void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let request: IDBRequest | void;
    t.oncomplete = () => resolve((request ? request.result : undefined) as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("Transacción cancelada"));
    try {
      request = fn(t);
    } catch (e) {
      try {
        t.abort();
      } catch {
        /* noop */
      }
      reject(e);
    }
  });
}

const prefixRange = (prefix: string) => IDBKeyRange.bound(prefix, prefix + "\uffff");

// ---------- API genérica ----------
export const getAll = <T>(store: StoreName) =>
  run<T[]>(store, "readonly", (t) => t.objectStore(store).getAll());

export const putOne = (store: StoreName, value: unknown) =>
  run(store, "readwrite", (t) => {
    t.objectStore(store).put(value);
  });

export const putMany = (store: StoreName, values: unknown[]) =>
  run(store, "readwrite", (t) => {
    const s = t.objectStore(store);
    for (const v of values) s.put(v);
  });

export const deleteOne = (store: StoreName, key: string) =>
  run(store, "readwrite", (t) => {
    t.objectStore(store).delete(key);
  });

export const clearStore = (store: StoreName) =>
  run(store, "readwrite", (t) => {
    t.objectStore(store).clear();
  });

export const deleteByPrefix = (store: StoreName, prefix: string) =>
  run(store, "readwrite", (t) => {
    t.objectStore(store).delete(prefixRange(prefix));
  });

// ---------- Específicos ----------
export const getPlaylists = () => getAll<Playlist>("playlists");
export const getFavorites = () => getAll<FavoriteEntry>("favorites");
export const getHistory = () => getAll<HistoryEntry>("history");
export const getStatuses = () => getAll<StatusEntry>("status");

export const getChannelsByPlaylist = (playlistId: string) =>
  run<Channel[]>("channels", "readonly", (t) =>
    t.objectStore("channels").index("playlistId").getAll(IDBKeyRange.only(playlistId)),
  );

export const getAllChannels = () => getAll<Channel>("channels");

/** Reemplaza atómicamente los canales de una lista (todo o nada). */
export const replacePlaylistChannels = (
  playlistId: string,
  channels: Channel[],
  playlist?: Playlist,
) =>
  run(["channels", "playlists"], "readwrite", (t) => {
    const s = t.objectStore("channels");
    const idx = s.index("playlistId");
    const cur = idx.openKeyCursor(IDBKeyRange.only(playlistId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        s.delete(c.primaryKey);
        c.continue();
      } else {
        for (const ch of channels) s.put(ch);
        if (playlist) t.objectStore("playlists").put(playlist);
      }
    };
  });

export const deletePlaylistCascade = (playlistId: string) =>
  run(["playlists", "channels", "favorites", "history", "status"], "readwrite", (t) => {
    t.objectStore("playlists").delete(playlistId);
    const prefix = prefixRange(playlistId + ":");
    t.objectStore("favorites").delete(prefix);
    t.objectStore("history").delete(prefix);
    t.objectStore("status").delete(prefix);
    const s = t.objectStore("channels");
    const cur = s.index("playlistId").openKeyCursor(IDBKeyRange.only(playlistId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        s.delete(c.primaryKey);
        c.continue();
      }
    };
  });

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await run<{ key: string; value: T } | undefined>("kv", "readonly", (t) =>
    t.objectStore("kv").get(key),
  );
  return row ? row.value : fallback;
}

export const setKv = (key: string, value: unknown) => putOne("kv", { key, value });

export async function wipeAll() {
  await run(["playlists", "channels", "favorites", "history", "status", "kv"], "readwrite", (t) => {
    for (const n of ["playlists", "channels", "favorites", "history", "status", "kv"] as const) {
      t.objectStore(n).clear();
    }
  });
}
