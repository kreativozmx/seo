import { NextResponse } from "next/server";
import { fetchShopifyStatus } from "@/lib/providers/shopifyStatus";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Global Shopify platform status — not project-specific, so no [id] here.
export async function GET() {
  try {
    const status = await fetchShopifyStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
