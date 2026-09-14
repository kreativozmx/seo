// Google Knowledge Graph Search API — free, API-key only. Tells you whether
// a brand/entity has an official Knowledge Panel on Google.
// Docs: https://developers.google.com/knowledge-graph

const BASE_URL = "https://kgsearch.googleapis.com/v1/entities:search";

export interface KnowledgeGraphResult {
  found: boolean;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  score: number | null;
}

export async function searchKnowledgeGraph(
  query: string
): Promise<KnowledgeGraphResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY no esta configurada");
  }

  const params = new URLSearchParams({
    query,
    key: apiKey,
    limit: "1",
    indent: "true",
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Knowledge Graph request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const item = json?.itemListElement?.[0];
  const result = item?.result;

  if (!result) {
    return { found: false, name: null, description: null, imageUrl: null, score: null };
  }

  return {
    found: true,
    name: result.name ?? null,
    description: result.description ?? null,
    imageUrl: result.image?.contentUrl ?? null,
    score: item.resultScore ?? null,
  };
}
