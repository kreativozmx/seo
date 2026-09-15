// Cleans up whatever a merchant pastes into the "manual shop domain" field
// so common mistakes don't turn into OAuth errors: a full URL with http(s)
// still works, and pasting the admin.shopify.com URL (which merchants
// copy from their browser far more often than the raw myshopify.com one)
// resolves to the right *.myshopify.com handle automatically.
//
// No server-only APIs here (just string parsing) so this can be imported
// from both the client form and the server-side install route.
export function normalizeShopifyShopInput(raw: string): string {
  let value = raw.trim();
  if (!value) return value;

  value = value.replace(/^https?:\/\//i, "");

  // https://admin.shopify.com/store/9a258f-3 -> 9a258f-3.myshopify.com
  const adminMatch = value.match(/^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/i);
  if (adminMatch) {
    return `${adminMatch[1].toLowerCase()}.myshopify.com`;
  }

  // Drop any trailing path/query — just the host.
  value = value.split("/")[0].split("?")[0].split("#")[0];

  return value.toLowerCase();
}
