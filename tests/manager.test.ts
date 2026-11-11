import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// El worker se sustituye por el parser síncrono (el módulo hace fallback igual en navegadores sin Worker)
vi.mock("../src/lib/parse-async", async () => {
  const { parseM3U } = await import("../src/lib/m3u");
  return {
    parseAsync: async (text: string, playlistId: string, baseUrl?: string) => parseM3U(text, { playlistId, baseUrl }),
  };
});

import { buildBackup, BackupError, parseBackup, restoreBackup } from "../src/lib/backup";
import * as db from "../src/lib/db";
import { importSource, removePlaylist, updatePlaylist } from "../src/lib/playlist-manager";
import type { Playlist } from "../src/lib/types";

(globalThis as unknown as { location: unknown }).location = { protocol: "http:" };

const LIST_A = `#EXTM3U
#EXTINF:-1 tvg-id="a" group-title="Noticias",Canal A
https://a.com/a.m3u8
#EXTINF:-1 tvg-id="b" group-title="Deportes",Canal B
https://a.com/b.m3u8
`;
const LIST_B = `#EXTM3U
#EXTINF:-1 tvg-id="x" group-title="Cine",Canal X
https://x.com/x.m3u8
`;

const file = (name: string, text: string) => new File([text], name, { type: "audio/x-mpegurl" });

beforeEach(async () => {
  await db.wipeAll();
  vi.unstubAllGlobals();
});

describe("importación y persistencia", () => {
  it("importa un archivo local y guarda copia en IndexedDB", async () => {
    const out = await importSource({ kind: "file", file: file("lista.m3u", LIST_A), name: "Mi lista" }, []);
    expect(out.status).toBe("imported");
    expect(out.channels).toBe(2);
    const pls = await db.getPlaylists();
    expect(pls).toHaveLength(1);
    expect(pls[0].name).toBe("Mi lista");
    expect(pls[0].channelCount).toBe(2);
    expect(await db.getChannelsByPlaylist(pls[0].id)).toHaveLength(2);
  });

  it("importa por URL (fetch simulado) y rechaza URLs inválidas", async () => {
    vi.stubGlobal("fetch", async () => new Response(LIST_A, { status: 200 }));
    const ok = await importSource({ kind: "url", url: "https://srv.com/pl.m3u" }, []);
    expect(ok.status).toBe("imported");
    expect(ok.playlist?.sourceType).toBe("url");

    const bad = await importSource({ kind: "url", url: "ftp://srv.com/pl.m3u" }, []);
    expect(bad.status).toBe("error");
    const bad2 = await importSource({ kind: "url", url: "javascript:alert(1)" }, []);
    expect(bad2.status).toBe("error");
  });

  it("informa de errores HTTP y de red/CORS", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 404 }));
    const a = await importSource({ kind: "url", url: "https://srv.com/x.m3u" }, []);
    expect(a.status).toBe("error");
    expect(a.message).toContain("404");

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const b = await importSource({ kind: "url", url: "https://srv.com/y.m3u" }, []);
    expect(b.status).toBe("error");
    expect(b.message).toContain("CORS");
    expect(await db.getPlaylists()).toHaveLength(0);
  });

  it("rechaza archivos que no son M3U", async () => {
    const out = await importSource({ kind: "file", file: file("x.m3u", "<html>hola</html>") }, []);
    expect(out.status).toBe("error");
    const empty = await importSource({ kind: "file", file: file("e.m3u", "") }, []);
    expect(empty.status).toBe("error");
  });

  it("detecta duplicados por URL y por contenido", async () => {
    vi.stubGlobal("fetch", async () => new Response(LIST_A, { status: 200 }));
    const first = await importSource({ kind: "url", url: "https://srv.com/pl.m3u" }, []);
    const existing = [first.playlist!];
    const sameUrl = await importSource({ kind: "url", url: "https://srv.com/pl.m3u/" }, existing);
    expect(sameUrl.status).toBe("duplicate");
    const sameContent = await importSource({ kind: "file", file: file("copia.m3u", LIST_A) }, existing);
    expect(sameContent.status).toBe("duplicate");
    const different = await importSource({ kind: "file", file: file("otra.m3u", LIST_B) }, existing);
    expect(different.status).toBe("imported");
  });

  it("actualiza conservando ids/favoritos y, si falla, conserva la copia local", async () => {
    vi.stubGlobal("fetch", async () => new Response(LIST_A, { status: 200 }));
    const first = await importSource({ kind: "url", url: "https://srv.com/pl.m3u" }, []);
    const pl = first.playlist as Playlist;
    const before = await db.getChannelsByPlaylist(pl.id);
    await db.putOne("favorites", { id: before[0].id, addedAt: 1 });

    const updatedText = LIST_A + `#EXTINF:-1 tvg-id="c" group-title="Cine",Canal C\nhttps://a.com/c.m3u8\n`;
    vi.stubGlobal("fetch", async () => new Response(updatedText, { status: 200 }));
    const up = await updatePlaylist(pl);
    expect(up.ok).toBe(true);
    expect(up.added).toBe(1);
    expect(up.removed).toBe(0);
    const after = await db.getChannelsByPlaylist(pl.id);
    expect(after).toHaveLength(3);
    expect(after.map((c) => c.id)).toEqual(expect.arrayContaining(before.map((c) => c.id)));
    expect(await db.getFavorites()).toHaveLength(1);

    // La URL deja de estar disponible: los datos siguen ahí
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    const fail = await updatePlaylist({ ...pl, channelCount: 3 });
    expect(fail.ok).toBe(false);
    expect(await db.getChannelsByPlaylist(pl.id)).toHaveLength(3);
    expect((await db.getPlaylists())[0].lastError).toBeTruthy();
  });

  it("eliminar una lista borra sus canales, favoritos, historial y estados", async () => {
    const out = await importSource({ kind: "file", file: file("a.m3u", LIST_A) }, []);
    const pl = out.playlist!;
    const [c] = await db.getChannelsByPlaylist(pl.id);
    await db.putOne("favorites", { id: c.id, addedAt: 1 });
    await db.putOne("history", { id: c.id, playedAt: 1, count: 1, name: c.name, logo: "" });
    await db.putOne("status", { id: c.id, ok: true, at: 1 });
    await removePlaylist(pl.id);
    expect(await db.getPlaylists()).toHaveLength(0);
    expect(await db.getAllChannels()).toHaveLength(0);
    expect(await db.getFavorites()).toHaveLength(0);
    expect(await db.getHistory()).toHaveLength(0);
    expect(await db.getStatuses()).toHaveLength(0);
  });

  it("importa 50 000 canales en IndexedDB en un tiempo razonable", async () => {
    const lines = ["#EXTM3U"];
    for (let i = 0; i < 50000; i++) lines.push(`#EXTINF:-1 tvg-id="c${i}" group-title="G${i % 40}",Canal ${i}`, `https://s.com/${i}.m3u8`);
    const t0 = performance.now();
    const out = await importSource({ kind: "file", file: file("grande.m3u", lines.join("\n")) }, []);
    const ms = performance.now() - t0;
    expect(out.channels).toBe(50000);
    expect((await db.getAllChannels()).length).toBe(50000);
    expect(ms).toBeLessThan(30000);
  }, 60000);
});

describe("copias de seguridad", () => {
  it("exporta y restaura listas, favoritos, historial y ajustes (round-trip)", async () => {
    const out = await importSource({ kind: "file", file: file("a.m3u", LIST_A), name: "Original" }, []);
    const pl = out.playlist!;
    const [c] = await db.getChannelsByPlaylist(pl.id);
    await db.putOne("favorites", { id: c.id, addedAt: 5 });
    await db.putOne("history", { id: c.id, playedAt: 9, count: 2, name: c.name, logo: "" });
    await db.setKv("settings", { theme: "light" });

    const backup = JSON.parse(JSON.stringify(await buildBackup("full")));
    await db.wipeAll();
    expect(await db.getPlaylists()).toHaveLength(0);

    const summary = await restoreBackup(parseBackup(backup), false);
    expect(summary.playlists).toBe(1);
    expect(summary.channels).toBe(2);
    expect((await db.getPlaylists())[0].name).toBe("Original");
    expect((await db.getPlaylists())[0].channelCount).toBe(2);
    expect(await db.getFavorites()).toEqual([{ id: c.id, addedAt: 5 }]);
    expect((await db.getHistory())[0].count).toBe(2);
    expect((await db.getKv<{ theme: string }>("settings", { theme: "x" })).theme).toBe("light");
  });

  it("rechaza archivos ajenos y sanea contenido manipulado", () => {
    expect(() => parseBackup({ hola: 1 })).toThrow(BackupError);
    expect(() => parseBackup(null)).toThrow(BackupError);
    expect(() => parseBackup({ app: "NEXA IPTV", version: 1, kind: "full" })).toThrow(BackupError);

    const b = parseBackup({
      app: "NEXA IPTV",
      version: 1,
      kind: "playlists",
      playlists: [{ id: "p1", name: "ok" }, { id: "../../mal", name: "x" }],
      channels: [
        { id: "p1:aaa", playlistId: "p1", name: "Bien", url: "https://ok.com/a.m3u8", logo: "javascript:alert(1)" },
        { id: "p1:bbb", playlistId: "p1", name: "Mal", url: "javascript:alert(1)" },
        { id: "zz:ccc", playlistId: "zz", name: "Huérfano", url: "https://ok.com/c.m3u8" },
      ],
    });
    expect(b.playlists).toHaveLength(1);
    expect(b.channels).toHaveLength(1);
    expect(b.channels![0].logo).toBe("");
    expect(b.playlists![0].channelCount).toBe(1);
  });

  it("restaurar reemplazando borra los datos previos", async () => {
    await importSource({ kind: "file", file: file("a.m3u", LIST_A) }, []);
    const backup = parseBackup({ app: "NEXA IPTV", version: 1, kind: "config", settings: { theme: "dark" } });
    await restoreBackup(backup, true);
    expect(await db.getPlaylists()).toHaveLength(0);
  });
});
