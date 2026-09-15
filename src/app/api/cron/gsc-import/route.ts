import { NextRequest, NextResponse } from "next/server";
import { runDailyGscImport } from "@/lib/dailyCheck";

// Triggered by Vercel Cron Jobs in production (GET, see vercel.json) —
// Vercel automatically sends "Authorization: Bearer $CRON_SECRET" when a
// project env var named exactly CRON_SECRET is set, so this checks for
// that same value. Without CRON_SECRET configured (e.g. plain local dev),
// any caller is allowed, matching the previous cron endpoint's behavior.
//
// Free (Search Console API has no per-call cost), unlike
// /api/cron/run-daily which also checks DataForSEO rankings.
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDailyGscImport();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
