// OpenAI Chat Completions — used to generate SEO/viral title and
// description suggestions for YouTube videos. Cheap, on-demand, one video
// at a time (never run automatically in bulk).
// Docs: https://platform.openai.com/docs/api-reference/chat

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
