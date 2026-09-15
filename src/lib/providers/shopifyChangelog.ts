// Shopify publishes an official RSS feed for changelog.shopify.com — no
// scraping needed. Kept dependency-free (no XML parser lib) since the feed
// is small and its structure is stable/simple.

export interface ShopifyChangelogItem {
  title: string;
  link: string;
  category: string;
  publishedAt: string; // ISO
  descriptionHtml: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return "";
  const raw = match[1];
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decodeEntities((cdata ? cdata[1] : raw).trim());
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchShopifyChangelogRss(
  limit = 20
): Promise<ShopifyChangelogItem[]> {
  const res = await fetch("https://changelog.shopify.com/feed.xml", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopifyAuditBot/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`No se pudo leer el changelog de Shopify (${res.status})`);
  }
  const xml = await res.text();

  const items: ShopifyChangelogItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) && items.length < limit) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const category = extractTag(block, "category") || "General";
    const pubDateRaw = extractTag(block, "pubDate");
    const descriptionHtml = extractTag(block, "description");
    if (!title || !link) continue;

    const parsedDate = pubDateRaw ? new Date(pubDateRaw) : null;
    items.push({
      title,
      link,
      category,
      publishedAt:
        parsedDate && !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : new Date().toISOString(),
      descriptionHtml,
    });
  }

  return items;
}
