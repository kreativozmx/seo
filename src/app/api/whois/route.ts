import { NextRequest, NextResponse } from "next/server";
import { lookupDomain } from "@/lib/providers/whois";

export const maxDuration = 30;

// Top-bar domain lookup. Behind the app login (not in the public path list).
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  try {
    return NextResponse.json(await lookupDomain(domain));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 400 });
  }
}
