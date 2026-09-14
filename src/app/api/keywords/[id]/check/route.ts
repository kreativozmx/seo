import { NextRequest, NextResponse } from "next/server";
import { checkKeywordNow } from "@/lib/rankingCheck";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rankings = await checkKeywordNow(params.id);
    return NextResponse.json({ rankings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
