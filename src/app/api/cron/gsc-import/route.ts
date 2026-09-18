import { NextRequest, NextResponse } from "next/server";
import { runDailyGscImport } from "@/lib/dailyCheck";
import { runWeeklyEmailSummaries } from "@/lib/weeklyEmail";

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

    // Piggybacks on this daily cron instead of registering a separate
    // Vercel Cron entry — the Hobby plan caps projects at 2 cron jobs,
    // and this project already uses both (gsc-import + changelog-sync).
    // Only actually sends on Mondays.
    let weeklyEmail: { sent: number; failed: number; error: string | null } | null = null;
    if (new Date().getUTCDay() === 1) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      weeklyEmail = await runWeeklyEmailSummaries(baseUrl);
    }

    return NextResponse.json({ ...result, weeklyEmail });
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
