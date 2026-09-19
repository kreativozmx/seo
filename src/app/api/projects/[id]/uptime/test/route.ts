import { NextRequest, NextResponse } from "next/server";
import { sendUptimeTestEmails } from "@/lib/uptime";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const to = await sendUptimeTestEmails(params.id, baseUrl);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al enviar" }, { status: 500 });
  }
}
