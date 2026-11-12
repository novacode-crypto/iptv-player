// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { probeMany } from "../src/lib/availability";
import type { Channel } from "../src/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const base = {
  playlistId: "p1",
  name: "Canal",
  altName: "",
  tvgId: "",
  logo: "",
  group: "",
  category: "Otros" as const,
  language: "",
  country: "",
  order: 0,
};
const mk = (id: string, url: string): Channel => ({ ...base, id, name: `Canal ${id}`, url });

/** Respuesta mínima con la forma que usa el comprobador */
const fake = (status: number, opts: { body?: string; type?: string } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? opts.type ?? "" : "") },
  ...(opts.body !== undefined ? { text: async () => opts.body } : {}),
});

const MEDIA_M3U8 = "#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:2.0,\nseg0.ts\n#EXT-X-ENDLIST";
const MASTER_M3U8 = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\nv1.m3u8";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("comprobador de disponibilidad", () => {
  it("verifica la lista HLS y su primer segmento", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("lista.m3u8")) return fake(200, { body: MEDIA_M3U8, type: "application/vnd.apple.mpegurl" });
      return fake(200); // segmento
    });
    vi.stubGlobal("fetch", fetchMock);
    const { results, cancelled } = await probeMany([mk("a", "https://x.example/lista.m3u8")], { concurrency: 1 });
    expect(cancelled).toBe(false);
    expect(results[0].ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recorre master → variante → segmento", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("master.m3u8")) return fake(200, { body: MASTER_M3U8, type: "application/vnd.apple.mpegurl" });
      if (url.endsWith("v1.m3u8")) return fake(200, { body: MEDIA_M3U8, type: "application/vnd.apple.mpegurl" });
      return fake(200);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await probeMany([mk("a", "https://x.example/master.m3u8")], { concurrency: 1 });
    expect(results[0].ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("detecta una respuesta 200 que no es una lista HLS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fake(200, { body: "<html>página de error</html>", type: "text/html" })));
    const { results } = await probeMany([mk("a", "https://x.example/no-lista.m3u8")], { concurrency: 1 });
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toContain("No es una lista");
  });

  it("marca offline un HTTP 404 con su motivo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fake(404)));
    const { results } = await probeMany([mk("a", "https://x.example/muerto.m3u8")], { concurrency: 1 });
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toContain("404");
  });

  it("marca offline cuando fetch rechaza (CORS o red caída)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { results } = await probeMany([mk("a", "https://x.example/caido.m3u8")], { concurrency: 1 });
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toContain("CORS");
  });

  it("agota el tiempo de espera por canal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_res, rej) => {
            init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
          }),
      ),
    );
    const { results } = await probeMany([mk("a", "https://x.example/colgado.m3u8")], { concurrency: 1, timeoutMs: 60 });
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toContain("tiempo");
  });

  it("se puede detener a mitad de la comprobación", async () => {
    const ctrl = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await sleep(25);
        return fake(200);
      }),
    );
    const channels = [mk("a", "https://x.example/a.ts"), mk("b", "https://x.example/b.ts"), mk("c", "https://x.example/c.ts"), mk("d", "https://x.example/d.ts")];
    let completados = 0;
    const { results, cancelled } = await probeMany(channels, {
      concurrency: 2,
      signal: ctrl.signal,
      onResult: () => {
        if (++completados === 2) ctrl.abort();
      },
    });
    expect(cancelled).toBe(true);
    expect(results.length).toBeLessThan(channels.length);
  });

  it("limita la concurrencia de comprobaciones", async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active++;
        peak = Math.max(peak, active);
        await sleep(15);
        active--;
        return fake(200);
      }),
    );
    const channels = Array.from({ length: 8 }, (_, i) => mk(`c${i}`, `https://x.example/s${i}.ts`));
    const { results } = await probeMany(channels, { concurrency: 2 });
    expect(results).toHaveLength(8);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
