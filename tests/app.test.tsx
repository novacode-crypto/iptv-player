// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/parse-async", async () => {
  const { parseM3U } = await import("../src/lib/m3u");
  return { parseAsync: async (text: string, id: string, base?: string) => parseM3U(text, { playlistId: id, baseUrl: base }) };
});

import App from "../src/App";
import * as db from "../src/lib/db";
import { useStore } from "../src/lib/store";

/* eslint-disable @typescript-eslint/no-explicit-any */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1100 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 700 });
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (HTMLMediaElement.prototype as any).load = () => {};
  (HTMLMediaElement.prototype as any).play = () => Promise.resolve();
  (HTMLMediaElement.prototype as any).pause = () => {};
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as any;
});

afterEach(() => cleanup());

describe("App (render integral)", () => {
  it("primera ejecución → demo → explorador → favoritos → reproductor → persistencia", async () => {
    window.location.hash = "#/";
    await act(async () => {
      render(<App />);
    });
    await screen.findByText(/Bienvenido a/);

    await act(async () => {
      fireEvent.click(screen.getByText("Probar con lista de demostración"));
    });
    await screen.findByText("Reproducir ahora").catch(() => screen.findByText("Explorar canales"));
    expect(useStore.getState().channels).toHaveLength(5);

    await act(async () => {
      window.location.hash = "#/channels";
    });
    await screen.findByText("Todos los canales", { selector: "h1" });
    await screen.findByText("Big Buck Bunny (Prueba HLS)");

    const input = screen.getByLabelText("Buscar canales");
    await act(async () => {
      fireEvent.change(input, { target: { value: "sintel" } });
    });
    await waitFor(() => expect(screen.queryByText("Big Buck Bunny (Prueba HLS)")).toBeNull());
    expect(screen.getByText("Sintel (Prueba HLS)")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText("Añadir a favoritos")[0]);
    });
    expect(Object.keys(useStore.getState().favorites)).toHaveLength(1);
    await waitFor(async () => expect((await db.getFavorites()).length).toBe(1));

    await act(async () => {
      fireEvent.click(screen.getByText("Sintel (Prueba HLS)"));
    });
    await waitFor(() => expect(window.location.hash).toBe("#/watch"));
    await screen.findByLabelText("Pantalla completa (F)");
    expect(useStore.getState().currentChannelId).toBeTruthy();
    await waitFor(async () => expect((await db.getKv<any>("meta", {})).lastChannelId).toBeTruthy());

    for (const r of ["#/playlists", "#/recents", "#/favorites", "#/settings", "#/"]) {
      await act(async () => {
        window.location.hash = r;
      });
      await new Promise((res) => setTimeout(res, 30));
    }
    await screen.findByText("Continuar viendo");

    await act(async () => {
      await useStore.getState().reloadAll();
    });
    expect(useStore.getState().playlists).toHaveLength(1);
    expect(Object.keys(useStore.getState().favorites)).toHaveLength(1);
  }, 30000);

  it("cambia de tema y lo persiste", async () => {
    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      useStore.getState().setSettings({ theme: "light" });
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    await waitFor(async () => expect((await db.getKv<any>("settings", {})).theme).toBe("light"));
  });
});
