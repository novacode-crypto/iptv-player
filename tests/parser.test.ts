import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { parseM3U } from "../src/lib/m3u";

const parse = (t: string, baseUrl?: string) => parseM3U(t, { playlistId: "pl1", baseUrl });

describe("parser M3U", () => {
  it("lee atributos completos de #EXTINF", () => {
    const r = parse(`#EXTM3U
#EXTINF:-1 tvg-id="La1.es" tvg-name="La 1 HD" tvg-logo="https://x.com/l.png" group-title="Noticias" tvg-language="Spanish" tvg-country="ES",La 1
https://example.com/live/la1.m3u8
`);
    expect(r.kind).toBe("channels");
    expect(r.channels).toHaveLength(1);
    const c = r.channels[0];
    expect(c).toMatchObject({
      name: "La 1",
      altName: "La 1 HD",
      tvgId: "La1.es",
      logo: "https://x.com/l.png",
      group: "Noticias",
      category: "Noticias",
      language: "Spanish",
      country: "ES",
      url: "https://example.com/live/la1.m3u8",
    });
    expect(c.id.startsWith("pl1:")).toBe(true);
  });

  it("soporta atributos ausentes, comas dentro de comillas y CRLF/BOM", () => {
    const r = parse(
      "\ufeff#EXTM3U\r\n#EXTINF:-1 group-title=\"Cine, Series\",Canal, con coma\r\nhttp://a.com/1.ts\r\n#EXTINF:-1,Sin atributos\r\nhttp://a.com/2.m3u8\r\nhttp://a.com/sin-extinf/stream.m3u8\r\n",
    );
    expect(r.channels).toHaveLength(3);
    expect(r.channels[0].name).toBe("Canal, con coma");
    expect(r.channels[0].group).toBe("Cine, Series");
    expect(r.channels[1].group).toBe("");
    expect(r.channels[1].category).toBe("Otros");
    expect(r.channels[2].name).toBe("stream"); // nombre derivado de la URL
  });

  it("usa #EXTGRP y omite directivas desconocidas", () => {
    const r = parse(`#EXTM3U
#EXTINF:-1,Canal A
#EXTGRP:Deportes HD
#EXTVLCOPT:http-user-agent=foo
https://a.com/a.m3u8
`);
    expect(r.channels[0].group).toBe("Deportes HD");
    expect(r.channels[0].category).toBe("Deportes");
  });

  it("elimina URLs duplicadas dentro de la lista y las cuenta", () => {
    const r = parse(`#EXTM3U
#EXTINF:-1,A
https://a.com/1.m3u8
#EXTINF:-1,A copia
https://a.com/1.m3u8
#EXTINF:-1,B
https://a.com/2.m3u8
`);
    expect(r.channels).toHaveLength(2);
    expect(r.duplicatesRemoved).toBe(1);
  });

  it("genera ids estables y únicos aunque el nombre se repita", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="x",Mismo
https://a.com/1.m3u8
#EXTINF:-1 tvg-id="x",Mismo
https://a.com/2.m3u8
`;
    const a = parse(text).channels.map((c) => c.id);
    const b = parse(text.replace(/a\.com/g, "b.com")).channels.map((c) => c.id);
    expect(new Set(a).size).toBe(2);
    expect(a).toEqual(b); // la URL no forma parte del id: sobrevive a cambios de token/host
  });

  it("rechaza esquemas peligrosos y logos no http(s)", () => {
    const r = parse(`#EXTM3U
#EXTINF:-1 tvg-logo="javascript:alert(1)",Mal
javascript:alert(1)
#EXTINF:-1 tvg-logo="data:image/svg+xml;base64,AAA",Logo data
https://ok.com/a.m3u8
#EXTINF:-1,<img src=x onerror=alert(1)>
https://ok.com/b.m3u8
`);
    expect(r.skipped).toBe(1);
    expect(r.channels).toHaveLength(2);
    expect(r.channels[0].logo).toBe("");
    // el texto se conserva literal: React lo escapa al renderizar
    expect(r.channels[1].name).toContain("<img");
  });

  it("resuelve URLs relativas respecto a la fuente", () => {
    const r = parse(`#EXTM3U\n#EXTINF:-1 tvg-logo="logos/a.png",A\nstreams/a.m3u8\n`, "https://host.com/lists/main.m3u");
    expect(r.channels[0].url).toBe("https://host.com/lists/streams/a.m3u8");
    expect(r.channels[0].logo).toBe("https://host.com/lists/logos/a.png");
  });

  it("detecta manifiestos HLS y contenido no válido", () => {
    expect(parse("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nseg1.ts\n").kind).toBe("hls-manifest");
    expect(parse("<html><body>404</body></html>").kind).toBe("invalid");
    expect(parse("#EXTM3U\n").kind).toBe("invalid");
  });

  it("rinde bien con listas grandes (60 000 canales)", () => {
    const lines = ["#EXTM3U"];
    for (let i = 0; i < 60000; i++) {
      lines.push(`#EXTINF:-1 tvg-id="c${i}" tvg-logo="https://l.com/${i}.png" group-title="Grupo ${i % 50}",Canal ${i}`);
      lines.push(`https://s.com/${i}.m3u8`);
    }
    const t0 = performance.now();
    const r = parse(lines.join("\n"));
    const ms = performance.now() - t0;
    expect(r.channels).toHaveLength(60000);
    expect(new Set(r.channels.map((c) => c.id)).size).toBe(60000);
    expect(ms).toBeLessThan(4000);
  });
});

describe("categorías", () => {
  it.each([
    ["Noticias 24h", "Noticias"],
    ["Sports HD", "Deportes"],
    ["Películas", "Películas"],
    ["Movies", "Películas"],
    ["Kids", "Infantiles"],
    ["Documentales", "Documentales"],
    ["Music", "Música"],
    ["Entertainment", "Entretenimiento"],
    ["Spain", "Otros"],
    ["", "Otros"],
  ])("%s → %s", (g, cat) => {
    expect(categorize(g)).toBe(cat);
  });
});
