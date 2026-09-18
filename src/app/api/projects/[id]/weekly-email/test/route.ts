import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyEmailTest } from "@/lib/weeklyEmail";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    await sendWeeklyEmailTest(params.id, baseUrl);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
