import { prisma } from "@/lib/prisma";
import {
  fetchShopifyChangelogRss,
  stripHtml,
} from "@/lib/providers/shopifyChangelog";
import { translateChangelogEntry } from "@/lib/providers/openai";

// Pulls the latest entries from Shopify's official changelog RSS, and
// translates (title + short original summary) only the ones we haven't
// stored yet — existing entries are never re-translated, so this is cheap
// to run daily.
export async function syncShopifyChangelog() {
  const items = await fetchShopifyChangelogRss(30);

  let added = 0;
  let failed = 0;

  for (const item of items) {
    const existing = await prisma.shopifyChangelogEntry.findUnique({
      where: { sourceUrl: item.link },
      select: { id: true },
    });
    if (existing) continue;

    try {
      const { titleEs, summaryEs } = await translateChangelogEntry({
        title: item.title,
        bodyText: stripHtml(item.descriptionHtml),
      });

      await prisma.shopifyChangelogEntry.create({
        data: {
          sourceUrl: item.link,
          title: item.title,
          titleEs,
          summaryEs,
          category: item.category,
          publishedAt: new Date(item.publishedAt),
        },
      });
      added++;
    } catch {
      failed++;
    }
  }

  return { added, failed, checked: items.length };
}
