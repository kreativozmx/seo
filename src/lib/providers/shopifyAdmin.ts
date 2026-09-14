// Shopify Admin API — real sales data for YOUR OWN store only, obtained via
// the standard one-click OAuth install (see src/lib/shopifyAuth.ts), not a
// manually-created token. There is no way to see another store's sales
// through any API — that data is private to the store owner, full stop.

const API_VERSION = "2024-10";

export interface ShopifySalesSummary {
  orders: number;
  totalSales: number;
  currency: string | null;
}

export async function fetchShopifySales(
  shopDomain: string,
  accessToken: string,
  days = 28
): Promise<ShopifySalesSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const url = `https://${shopDomain}/admin/api/${API_VERSION}/orders.json?status=any&created_at_min=${since.toISOString()}&limit=250&fields=total_price,currency`;

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify Admin API request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const orders: { total_price?: string; currency?: string }[] = json?.orders ?? [];

  const totalSales = orders.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0);

  return {
    orders: orders.length,
    totalSales,
    currency: orders[0]?.currency ?? null,
  };
}
