import type { CategoryName } from "./types";
import { normalize } from "./utils";

export const CATEGORIES: CategoryName[] = [
  "Noticias",
  "Deportes",
  "Entretenimiento",
  "Películas",
  "Series",
  "Infantiles",
  "Música",
  "Documentales",
  "Internacionales",
  "Otros",
];

/**
 * Reglas ordenadas. Solo se evalúa el `group-title` original: la categoría
 * es una agrupación de visualización; el grupo original se conserva intacto.
 */
const RULES: [CategoryName, RegExp][] = [
  ["Noticias", /noticia|news|actualidad|nachrichten|notizie|nouvelles|informativ|24h|24 horas/],
  ["Deportes", /deport|sport|futbol|football|soccer|nba|nfl|nhl|mlb|liga|motor|formula|fight|ufc|wwe|tenis|tennis|golf|baloncesto|basket/],
  ["Películas", /pelicula|movie|cine|film|cinema|kino/],
  ["Series", /serie|tv show|telenovela|novela|drama/],
  ["Documentales", /document|nature|naturaleza|discovery|histor|ciencia|science|geograph|viaje|travel|wildlife/],
  ["Infantiles", /infantil|kids?\b|children|nino|cartoon|animaci|anime|junior|dibujos|toons/],
  ["Música", /music|musica|mtv|hits|concert|karaoke|radio/],
  ["Entretenimiento", /entreten|entertain|general|variety|variedad|comedy|comedia|lifestyle|reality|show|estilo de vida/],
  ["Internacionales", /internacion|international|world|mundo|global|foreign|extranjer/],
];

export function categorize(group: string): CategoryName {
  if (!group) return "Otros";
  const g = normalize(group);
  for (const [cat, re] of RULES) if (re.test(g)) return cat;
  return "Otros";
}
