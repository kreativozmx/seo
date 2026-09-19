// Google / YouTube autocomplete (suggestqueries.google.com). Free and keyless
// but UNOFFICIAL: it's the endpoint browsers use, has no SLA or published
// quota and may change or throttle, so every caller treats failure as
// "no suggestions" rather than an error.
export type SuggestSource = "google" | "youtube";

async function fetchSuggestions(q: string, source: SuggestSource, hl: string, gl: string): Promise<string[]> {
  const params = new URLSearchParams({ client: "firefox", q, hl, gl });
  if (source === "youtube") params.set("ds", "yt");
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?${params.toString()}`, {
      signal: AbortSignal.timeout(4000),
      headers: { "user-agent": "Mozilla/5.0 ShopifyAudit/1.0" },
    });
    if (!res.ok) return [];
    // The YouTube variant answers in ISO-8859-1, not UTF-8 — decode by declared charset.
    const charset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ?? "utf-8";
    const text = new TextDecoder(charset).decode(await res.arrayBuffer());
    const json = JSON.parse(text) as [string, string[]];
    return Array.isArray(json?.[1]) ? json[1].filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

// `expand` also asks for "<q> a" ... "<q> z" (26 extra requests, in small
// batches) — the classic way to surface long-tail variations.
export async function getSuggestions(opts: {
  q: string;
  source?: SuggestSource;
  hl?: string;
  gl?: string;
  expand?: boolean;
}): Promise<string[]> {
  const { q, source = "google", hl = "es", gl = "mx", expand = false } = opts;
  const base = await fetchSuggestions(q, source, hl, gl);
  if (!expand) return base;

  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const all = new Set(base);
  for (let i = 0; i < letters.length; i += 6) {
    const batch = await Promise.all(letters.slice(i, i + 6).map((l) => fetchSuggestions(`${q} ${l}`, source, hl, gl)));
    batch.flat().forEach((s) => all.add(s));
  }
  return Array.from(all).slice(0, 150);
}
