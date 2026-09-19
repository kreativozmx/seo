import { NextRequest, NextResponse } from "next/server";
import { runUptimeChecks } from "@/lib/uptime";

export const maxDuration = 60;

// Called every 10 min by .github/workflows/uptime.yml (Vercel Hobby crons
// can't run that often). Same CRON_SECRET bearer pattern as the other crons.
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    return NextResponse.json(await runUptimeChecks(baseUrl));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
