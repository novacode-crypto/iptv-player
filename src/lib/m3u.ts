import { categorize } from "./categories";
import type { Channel } from "./types";
import { hash64 } from "./utils";

export interface ParseOptions {
  playlistId: string;
  /** URL de origen, para resolver rutas relativas */
  baseUrl?: string;
  onProgress?: (fraction: number) => void;
}

export interface ParseResult {
  kind: "channels" | "hls-manifest" | "invalid";
  channels: Channel[];
  duplicatesRemoved: number;
  skipped: number;
  totalLines: number;
}

const STREAM_SCHEMES = new Set([
  "http:",
  "https:",
  "rtmp:",
  "rtmps:",
  "rtsp:",
  "udp:",
  "rtp:",
  "mms:",
  "mmsh:",
  "srt:",
]);

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;

function clean(value: string, max: number): string {
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function resolveUrl(raw: string, baseUrl?: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const u = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (!STREAM_SCHEMES.has(u.protocol)) return null;
    // Se conserva la cadena original cuando ya es absoluta para no alterarla
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : u.href;
  } catch {
    return null;
  }
}

function resolveLogo(raw: string | undefined, baseUrl?: string): string {
  if (!raw) return "";
  const value = raw.trim();
  if (!value) return "";
  try {
    const u = value.startsWith("//")
      ? new URL("https:" + value)
      : baseUrl
        ? new URL(value, baseUrl)
        : new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href.slice(0, 600);
  } catch {
    return "";
  }
}

/** Separa "attrs,Título" respetando comillas */
function splitExtinf(line: string): { attrs: string; title: string } {
  const body = line.slice(line.indexOf(":") + 1);
  let quote = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ",") {
      return { attrs: body.slice(0, i), title: body.slice(i + 1) };
    }
  }
  return { attrs: body, title: "" };
}

const ATTR_RE = /([A-Za-z0-9_.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,"']+))/g;

function parseAttrs(attrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(attrs))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return clean(seg ? decodeURIComponent(seg).replace(/\.[a-z0-9]{2,4}$/i, "") : u.hostname, 120);
  } catch {
    return "Canal";
  }
}

export function parseM3U(text: string, opts: ParseOptions): ParseResult {
  const { playlistId, baseUrl, onProgress } = opts;
  // BOM + normalización de saltos de línea
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = src.split(/\r\n|\n|\r/);

  const head = src.slice(0, 4000);
  const looksLikeM3u = /^\s*#EXTM3U/i.test(src) || /#EXTINF/i.test(head);
  const isHlsManifest =
    /#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE|MEDIA:|VERSION)/i.test(head) &&
    !/tvg-|group-title/i.test(head);

  if (!looksLikeM3u) {
    return { kind: "invalid", channels: [], duplicatesRemoved: 0, skipped: 0, totalLines: lines.length };
  }
  if (isHlsManifest) {
    return { kind: "hls-manifest", channels: [], duplicatesRemoved: 0, skipped: 0, totalLines: lines.length };
  }

  const channels: Channel[] = [];
  const seenUrls = new Set<string>();
  const idCount = new Map<string, number>();
  let duplicatesRemoved = 0;
  let skipped = 0;

  let pending: { attrs: Record<string, string>; title: string } | null = null;
  let extGroup = "";

  for (let i = 0; i < lines.length; i++) {
    if (onProgress && i % 8000 === 0) onProgress(i / lines.length);
    const line = lines[i].trim();
    if (!line) continue;

    if (line.charCodeAt(0) === 35 /* # */) {
      if (/^#EXTINF:/i.test(line)) {
        const { attrs, title } = splitExtinf(line);
        pending = { attrs: parseAttrs(attrs), title };
      } else if (/^#EXTGRP:/i.test(line)) {
        extGroup = line.slice(8).trim();
      }
      // Resto de directivas (#EXTVLCOPT, #KODIPROP, #EXTM3U…) se ignoran
      continue;
    }

    const url = resolveUrl(line, baseUrl);
    if (!url) {
      skipped++;
      pending = null;
      extGroup = "";
      continue;
    }

    if (seenUrls.has(url)) {
      duplicatesRemoved++;
      pending = null;
      extGroup = "";
      continue;
    }
    seenUrls.add(url);

    const a = pending?.attrs ?? {};
    const tvgName = clean(a["tvg-name"] ?? "", 200);
    const title = clean(pending?.title ?? "", 200);
    const tvgId = clean(a["tvg-id"] ?? "", 120);
    const name = title || tvgName || tvgId || nameFromUrl(url);
    const group = clean(a["group-title"] ?? extGroup ?? "", 120);

    const key = `${tvgId}|${name.toLowerCase()}|${group.toLowerCase()}`;
    const base = hash64(key);
    const n = idCount.get(base) ?? 0;
    idCount.set(base, n + 1);

    channels.push({
      id: `${playlistId}:${n === 0 ? base : `${base}~${n}`}`,
      playlistId,
      name,
      altName: tvgName && tvgName !== name ? tvgName : "",
      tvgId,
      logo: resolveLogo(a["tvg-logo"], baseUrl),
      group,
      category: categorize(group),
      language: clean(a["tvg-language"] ?? "", 60),
      country: clean(a["tvg-country"] ?? "", 60),
      url,
      order: channels.length,
    });

    pending = null;
    extGroup = "";
  }

  onProgress?.(1);
  return {
    kind: channels.length ? "channels" : "invalid",
    channels,
    duplicatesRemoved,
    skipped,
    totalLines: lines.length,
  };
}
