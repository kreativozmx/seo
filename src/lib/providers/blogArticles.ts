// Finds the blog articles a site has already published, so the content-idea
// generator can avoid repeating them (and the UI can show which ones it saw).
//
// Source of truth is the site's sitemap: Shopify lists every article in
// sitemap_blogs_*.xml (and other CMSs usually expose /blog/ URLs in theirs).
// Shopify's per-blog articles.json is NOT public (404), so titles come from
// the blog's public .atom feed (latest ~30) plus each remaining article
// page's own <title>/og:title, falling back to a humanized URL slug.
export interface PublishedArticle {
  title: string;
  url: string;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const MAX_PAGE_TITLE_FETCHES = 80;
const PAGE_FETCH_CONCURRENCY = 8;

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi), (m) => m[1]);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeSlug(url: string): string {
  const slug = decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).pop() ?? "");
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : url;
}

// Shopify articles live at /blogs/{handle}/{slug}; the bare /blogs/{handle}
// (2 segments) is the blog index, not an article.
function isShopifyArticleUrl(url: string) {
  return /\/blogs\/[^/]+\/[^/?#]+/.test(url);
}
function isGenericArticleUrl(url: string) {
  return /\/(blog|noticias|articulos|articles|news)\/[^/?#]+/i.test(url);
}

async function titleFromPage(url: string): Promise<string | null> {
  const html = await fetchText(url, 8000);
  if (!html) return null;
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const raw = og?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return raw ? decodeEntities(raw) : null;
}

export async function fetchPublishedArticles(domain: string, max = 300): Promise<PublishedArticle[]> {
  const rootXml = await fetchText(`https://${domain}/sitemap.xml`);
  if (!rootXml) return [];

  // 1) Collect article URLs from the sitemap (Shopify blog sitemaps first,
  //    otherwise scan a few child sitemaps for blog-looking URLs).
  const rootLocs = locs(rootXml);
  let childSitemaps = rootLocs.filter((l) => /sitemap_blogs/i.test(l));
  const isIndex = /<sitemapindex/i.test(rootXml);
  if (childSitemaps.length === 0 && isIndex) {
    childSitemaps = rootLocs.filter((l) => !/product|collection|image|categor/i.test(l)).slice(0, 6);
  }

  const urlSet = new Set<string>();
  const sources = childSitemaps.length > 0 ? childSitemaps : [null];
  for (const src of sources) {
    const xml = src ? await fetchText(src) : rootXml;
    if (!xml) continue;
    for (const u of locs(xml)) {
      if (isShopifyArticleUrl(u) || (!/sitemap_blogs/.test(src ?? "") && isGenericArticleUrl(u))) urlSet.add(u);
    }
  }
  const urls = Array.from(urlSet).slice(0, max);
  if (urls.length === 0) return [];

  // 2) Titles from each Shopify blog's public .atom feed (latest entries).
  const titleByUrl = new Map<string, string>();
  const blogBases = new Set<string>();
  for (const u of urls) {
    const m = u.match(/^(.*\/blogs\/[^/]+)\/[^/?#]+/);
    if (m) blogBases.add(m[1]);
  }
  await Promise.all(
    Array.from(blogBases).map(async (base) => {
      const atom = await fetchText(`${base}.atom`);
      if (!atom) return;
      for (const entry of atom.split("<entry>").slice(1)) {
        const href = entry.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i)?.[1];
        const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
        if (href && title) titleByUrl.set(decodeEntities(href), decodeEntities(title.replace(/<!\[CDATA\[|\]\]>/g, "")));
      }
    })
  );

  // 3) Remaining articles: read each page's own title (capped, in small batches).
  const missing = urls.filter((u) => !titleByUrl.has(u)).slice(0, MAX_PAGE_TITLE_FETCHES);
  for (let i = 0; i < missing.length; i += PAGE_FETCH_CONCURRENCY) {
    const batch = missing.slice(i, i + PAGE_FETCH_CONCURRENCY);
    const titles = await Promise.all(batch.map(titleFromPage));
    batch.forEach((u, idx) => {
      if (titles[idx]) titleByUrl.set(u, titles[idx] as string);
    });
  }

  return urls.map((url) => ({ url, title: titleByUrl.get(url) ?? humanizeSlug(url) }));
}
