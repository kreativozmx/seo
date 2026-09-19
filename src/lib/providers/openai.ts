// OpenAI Chat Completions — used to generate SEO/viral title and
// description suggestions for YouTube videos. Cheap, on-demand, one video
// at a time (never run automatically in bulk).
// Docs: https://platform.openai.com/docs/api-reference/chat
import { LANGUAGE_PROMPT_NAMES } from "@/lib/locations";

const BASE_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no esta configurada");
  return key;
}

export interface YoutubeAiSuggestions {
  titles: string[];
  description: string;
}

export async function generateYoutubeSuggestions(params: {
  title: string;
  description: string;
  keywords: string[];
}): Promise<YoutubeAiSuggestions> {
  const { title, description, keywords } = params;

  const keywordLine =
    keywords.length > 0
      ? `Palabras clave que el canal esta posicionando en Google y le interesa reforzar: ${keywords.join(", ")}.`
      : "";

  const prompt = `Eres un experto en SEO de YouTube y copywriting de titulos virales en español.

Video actual:
Titulo: "${title}"
Descripcion: "${description || "(sin descripcion)"}"
${keywordLine}

Da tu respuesta SOLO como JSON valido con esta forma exacta, sin texto adicional:
{
  "titles": ["titulo 1", "titulo 2", "titulo 3", "titulo 4", "titulo 5"],
  "description": "descripcion optimizada completa"
}

Reglas para "titles": 5 propuestas de titulo alternativo, en español, que generen curiosidad o urgencia real (no clickbait vacio ni mayusculas excesivas), cada uno de maximo 70 caracteres, manteniendo el tema real del video.

Reglas para "description": una descripcion optimizada para SEO de YouTube (200-400 caracteres), con las primeras 1-2 lineas como gancho (lo que se ve sin expandir), incorporando naturalmente las palabras clave relevantes si aplican, y terminando con un llamado a la accion breve.`;

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvio contenido");

  let parsed: { titles?: unknown; description?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de OpenAI");
  }

  const titles = Array.isArray(parsed.titles)
    ? parsed.titles.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];
  const suggestedDescription = typeof parsed.description === "string" ? parsed.description : "";

  if (titles.length === 0 && !suggestedDescription) {
    throw new Error("OpenAI no devolvio sugerencias validas");
  }

  return { titles, description: suggestedDescription };
}

export interface ChangelogTranslation {
  titleEs: string;
  summaryEs: string;
}

// Translates a Shopify changelog entry's title and writes a short original
// summary (not a verbatim translation of the body) so we don't republish
// Shopify's full copyrighted write-up — just enough for a merchant to
// understand what changed, with a link back to the original.
export async function translateChangelogEntry(params: {
  title: string;
  bodyText: string;
}): Promise<ChangelogTranslation> {
  const { title, bodyText } = params;

  const prompt = `Traduce al español el siguiente titulo de una entrada del changelog oficial de Shopify, y escribe un resumen breve (2-3 oraciones, con tus propias palabras, no una traduccion literal) de que cambio y por que le importaria a un merchant de Shopify.

Titulo original (ingles): "${title}"
Contenido original (ingles): "${bodyText.slice(0, 2000)}"

Responde SOLO como JSON valido, sin texto adicional:
{
  "titleEs": "titulo traducido al español",
  "summaryEs": "resumen breve en español, en tus propias palabras"
}`;

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvio contenido");

  let parsed: { titleEs?: unknown; summaryEs?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de OpenAI");
  }

  const titleEs = typeof parsed.titleEs === "string" ? parsed.titleEs : title;
  const summaryEs = typeof parsed.summaryEs === "string" ? parsed.summaryEs : "";

  return { titleEs, summaryEs };
}

export interface ContentIdea {
  title: string;
  keywords: string[];
}

// 12 blog title ideas aimed at ranking the domain, based on real Search
// Console queries from the last 7 days — so suggestions follow actual
// demand instead of generic keyword brainstorming.
export async function generateContentIdeas(params: {
  domain: string;
  queries: { query: string; clicks: number; impressions: number }[];
  existingTitles?: string[];
  languageCode?: string;
}): Promise<ContentIdea[]> {
  const { domain, queries, existingTitles = [], languageCode = "es" } = params;
  const languageName = LANGUAGE_PROMPT_NAMES[languageCode] ?? "español";

  const queryLines = queries
    .slice(0, 60)
    .map((q) => `- "${q.query}" (${q.clicks} clics, ${q.impressions} impresiones)`)
    .join("\n");

  const existingTitlesBlock =
    existingTitles.length > 0
      ? `\n\nEl blog de la tienda ya tiene estos articulos publicados — NO propongas un titulo igual ni muy similar en tema a ninguno de estos, busca angulos o subtemas distintos que no se repitan:\n${existingTitles
          .slice(0, 200)
          .map((t) => `- "${t}"`)
          .join("\n")}`
      : "";

  const prompt = `Eres un estratega de contenido SEO para el sitio ${domain}.

Estas son las busquedas reales que la gente hizo en Google en los ultimos 7 dias y que ya le traen trafico o impresiones al sitio (datos de Google Search Console):
${queryLines}${existingTitlesBlock}

Con base en esas busquedas reales, genera exactamente 12 ideas de titulos de blog escritos en ${languageName}, pensados para ayudar a posicionar mejor el dominio en Google. Cada idea debe:
- Tener un titulo de blog atractivo y especifico (no generico), inspirado en una o varias de las busquedas reales de arriba.
- Traer 3 a 6 palabras clave relacionadas que ese articulo deberia intentar posicionar, tambien en ${languageName} (pueden incluir variantes de las busquedas reales, no solo copiarlas literal; si una busqueda real esta en otro idioma, adaptala a ${languageName}).
- No repetir tema ni titulo con ningun articulo que el blog ya tenga publicado (ver lista arriba, si existe).

Responde SOLO como JSON valido, sin texto adicional, con esta forma exacta:
{
  "ideas": [
    { "title": "titulo del blog 1", "keywords": ["keyword 1", "keyword 2", "keyword 3"] }
  ]
}
El array "ideas" debe tener exactamente 12 elementos.`;

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvio contenido");

  let parsed: { ideas?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de OpenAI");
  }

  if (!Array.isArray(parsed.ideas)) {
    throw new Error("OpenAI no devolvio ideas validas");
  }

  return parsed.ideas
    .filter(
      (idea): idea is { title: string; keywords: string[] } =>
        typeof idea === "object" &&
        idea !== null &&
        typeof (idea as { title?: unknown }).title === "string" &&
        Array.isArray((idea as { keywords?: unknown }).keywords)
    )
    .map((idea) => ({
      title: idea.title,
      keywords: idea.keywords.filter((k): k is string => typeof k === "string"),
    }))
    .slice(0, 12);
}

export interface YoutubeTitleIdea {
  title: string;
  why: string;
}

// Virality scale shown to the user (1-5) -> concrete writing guidance.
const VIRALITY_GUIDE: Record<number, string> = {
  1: "Nivel 1/5 (sobrio): titulos claros, informativos y enfocados en SEO/busqueda. Sin gancho emocional ni exageracion.",
  2: "Nivel 2/5 (moderado): claros y utiles, con un pequeno gancho de curiosidad o beneficio.",
  3: "Nivel 3/5 (equilibrado): mezcla de SEO y gancho — promesa concreta, numeros o un giro de curiosidad.",
  4: "Nivel 4/5 (llamativo): fuerte curiosidad o emocion, contraste, numeros, preguntas provocadoras; pensados para destacar en el feed.",
  5: "Nivel 5/5 (maximo viral): el titulo mas magnetico posible — brecha de curiosidad fuerte, emocion intensa, afirmaciones audaces o contraintuitivas. Debe seguir siendo veraz y coherente con lo que el canal puede entregar (nada enganoso).",
};

// New video title ideas for a channel, informed by what its existing
// videos already do (topics, and which ones got the most views).
export async function generateYoutubeTitleIdeas(params: {
  channelTitle: string;
  channelDescription: string | null;
  videos: { title: string; views: number }[];
  videoType: string;
  virality: number;
  languageCode: string;
  count?: number;
}): Promise<YoutubeTitleIdea[]> {
  const { channelTitle, channelDescription, videos, videoType, virality, languageCode, count = 10 } = params;
  const languageName = LANGUAGE_PROMPT_NAMES[languageCode] ?? "español";
  const level = Math.min(5, Math.max(1, Math.round(virality)));

  const videoLines = videos
    .slice(0, 40)
    .map((v) => `- "${v.title}" (${v.views.toLocaleString("en-US")} vistas)`)
    .join("\n");

  const prompt = `Eres un estratega de YouTube y copywriter de titulos.

Canal: "${channelTitle}"
Descripcion del canal: "${channelDescription || "(sin descripcion)"}"

Videos actuales del canal (con sus vistas):
${videoLines || "(el canal aun no tiene videos publicados)"}

Genera exactamente ${count} ideas de titulos para NUEVOS videos, escritos en ${languageName}.
Tipo de video: ${videoType}.
${VIRALITY_GUIDE[level]}

Reglas:
- Aprende de los videos actuales: repite el estilo y los temas que mejor funcionaron (mas vistas) sin copiar ningun titulo existente ni proponer un tema ya cubierto.
- Cada titulo de maximo 70 caracteres, sin exceso de mayusculas ni signos de exclamacion.
- Los titulos deben encajar con el nicho real del canal.
- Para cada uno agrega "why": una frase corta (maximo 20 palabras) que explique por que funcionaria (en ${languageName}).

Responde SOLO como JSON valido, sin texto adicional:
{ "ideas": [ { "title": "...", "why": "..." } ] }`;

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4 + level * 0.1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvio contenido");
  const parsed = JSON.parse(content) as { ideas?: { title?: string; why?: string }[] };
  return (parsed.ideas ?? [])
    .filter((i): i is { title: string; why?: string } => typeof i.title === "string" && i.title.trim().length > 0)
    .map((i) => ({ title: i.title.trim(), why: (i.why ?? "").trim() }))
    .slice(0, count);
}
