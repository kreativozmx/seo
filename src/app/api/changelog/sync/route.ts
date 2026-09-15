import { NextResponse } from "next/server";
import { syncShopifyChangelog } from "@/lib/changelogSync";

// Manual trigger for the "Actualizar" button in the Changelog Shopify tab.
export async function POST() {
  try {
    const result = await syncShopifyChangelog();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
