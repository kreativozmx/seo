// Finds broken links (404s and other errors) by crawling the site's own
// sitemap.xml right now and checking each URL's live HTTP status.
//
// There is no Search Console API for this — the "Pages"/Coverage report
// that shows 404s only exists in the GSC web UI; Google deprecated the old
// Crawl Errors API years ago and never replaced it. Checking the sitemap
// live is the closest free, real, immediate equivalent: it can't tell us
// what Google's crawler saw historically, but it tells us what's actually
// broken on the site right now.

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
};

const FETCH_TIMEOUT_MS = 5000;
// Sitemaps can list thousands of URLs (every product/variant); checking
// all of them synchronously in one request would blow past serverless
// function time limits, so we cap it. Prioritizes catching real,
// impactful 404s (pages/collections/products) over exhaustiveness.
// Kept gentle on purpose — Shopify's own storefront starts returning 429
// (rate limited) well before a modern server could actually time out, and
// a burst of 429s is not a real broken link.
const MAX_URLS_TO_CHECK = 150;
const CHECK_CONCURRENCY = 6;
const BATCH_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, headers: BROWSER_HEADERS, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractLocs(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  return Array.from(matches, (m) => m[1]);
}

// Shopify (and most modern sites) serve a sitemap INDEX at /sitemap.xml
// that points to per-type sub-sitemaps (products, collections, pages,
// blogs) — we need one level of recursion to reach actual page URLs.
export async function fetchSitemapUrls(domain: string, maxUrls = MAX_URLS_TO_CHECK): Promise<string[]> {
  const res = await fetchWithTimeout(`https://${domain}/sitemap.xml`);
  if (!res || !res.ok) {
    throw new Error(`No se pudo leer /sitemap.xml (status ${res?.status ?? "sin respuesta"}).`);
  }
  const rootXml = await res.text();
  const locs = extractLocs(rootXml);
  if (locs.length === 0) return [];

  const isIndex = /<sitemapindex/i.test(rootXml);
  if (!isIndex) {
    return locs.slice(0, maxUrls);
  }

  // Sub-sitemap index: fetch each child sitemap and collect URLs until we
  // hit the cap. Prioritize pages/collections before products/blogs since
  // a broken category or info page usually matters more than one variant.
  const ordered = [...locs].sort((a, b) => {
    const rank = (u: string) => (/sitemap_pages|collections/i.test(u) ? 0 : /sitemap_products/i.test(u) ? 1 : 2);
    return rank(a) - rank(b);
  });

  const urls: string[] = [];
  for (const sitemapUrl of ordered) {
    if (urls.length >= maxUrls) break;
    const childRes = await fetchWithTimeout(sitemapUrl);
    if (!childRes || !childRes.ok) continue;
    const childXml = await childRes.text();
    urls.push(...extractLocs(childXml));
  }
  return urls.slice(0, maxUrls);
}

export interface BrokenLink {
  url: string;
  path: string;
  status: number;
}

// Only 404/410 count as a confirmed broken link. Anything else (429 rate
// limited, 403 bot-protection, 5xx, a network timeout) is inconclusive —
// it says more about us hammering the store than about the page actually
// being broken — so those are retried once with a short backoff and then
// silently skipped rather than reported as broken.
async function checkOne(url: string, retrying = false): Promise<BrokenLink | null> {
  // HEAD first (cheaper) but some stores/CDNs don't support it properly —
  // fall back to GET before concluding it's actually broken.
  let res = await fetchWithTimeout(url, { method: "HEAD" });
  if (!res || res.status === 405 || res.status === 501) {
    res = await fetchWithTimeout(url, { method: "GET" });
  }
  if (!res) return null; // network/timeout — not conclusively broken, skip

  if ((res.status === 429 || res.status === 403 || res.status >= 500) && !retrying) {
    await sleep(1500);
    return checkOne(url, true);
  }

  if (res.status === 404 || res.status === 410) {
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch {
      // keep full url as fallback
    }
    return { url, path, status: res.status };
  }
  return null;
}

// Hard time budget regardless of how the concurrency/retry math works out
// in the worst case — better to return partial, honest results (fewer
// URLs checked) than to blow past the serverless function's own timeout
// and return nothing at all.
const TIME_BUDGET_MS = 45000;

export async function findBrokenLinks(
  domain: string
): Promise<{ checked: number; broken: BrokenLink[] }> {
  const urls = await fetchSitemapUrls(domain);
  const broken: BrokenLink[] = [];
  const startedAt = Date.now();
  let checked = 0;

  for (let i = 0; i < urls.length; i += CHECK_CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    const batch = urls.slice(i, i + CHECK_CONCURRENCY);
    const results = await Promise.all(batch.map((u) => checkOne(u)));
    checked += batch.length;
    for (const r of results) {
      if (r) broken.push(r);
    }
    if (i + CHECK_CONCURRENCY < urls.length) await sleep(BATCH_DELAY_MS);
  }

  return { checked, broken };
}
