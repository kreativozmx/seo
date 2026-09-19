// Open PageRank (openpagerank.com): a free 0-10 domain authority score built
// from Common Crawl link data — a cheap stand-in for paid "domain rating"
// numbers. Needs a free API key (OPEN_PAGERANK_API_KEY).
export interface DomainAuthority {
  score: number | null; // 0-10, decimal
  globalRank: number | null;
}

export async function fetchDomainAuthority(domains: string[]): Promise<Record<string, DomainAuthority>> {
  const key = process.env.OPEN_PAGERANK_API_KEY;
  if (!key) {
    throw new Error(
      "Falta OPEN_PAGERANK_API_KEY: crea una llave gratis en openpagerank.com y agregala a las variables de entorno."
    );
  }
  const params = domains.slice(0, 100).map((d) => `domains[]=${encodeURIComponent(d)}`).join("&");
  const res = await fetch(`https://openpagerank.com/api/v1.0/getPageRank?${params}`, {
    headers: { "API-OPR": key },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Open PageRank respondio ${res.status}`);
  const json = (await res.json()) as {
    response?: { domain: string; page_rank_decimal?: number | null; rank?: string | number | null; status_code?: number }[];
  };
  const out: Record<string, DomainAuthority> = {};
  for (const r of json.response ?? []) {
    out[r.domain] = {
      score: r.status_code === 200 && r.page_rank_decimal != null ? Number(r.page_rank_decimal) : null,
      globalRank: r.rank != null && r.rank !== "" ? Number(r.rank) : null,
    };
  }
  return out;
}
