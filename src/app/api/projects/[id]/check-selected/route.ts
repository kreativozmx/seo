import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkKeywordNow } from "@/lib/rankingCheck";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const keywordIds: string[] = Array.isArray(body.keywordIds) ? body.keywordIds : [];
  if (keywordIds.length === 0) {
    return NextResponse.json({ error: "keywordIds is required" }, { status: 400 });
  }

  const keywords = await prisma.keyword.findMany({
    where: {
      id: { in: keywordIds },
      projectId: params.id,
      archivedAt: null,
      engine: { in: ["google", "bing"] },
    },
  });

  const results: { keywordId: string; ok: boolean; error?: string }[] = [];

  for (const keyword of keywords) {
    try {
      await checkKeywordNow(keyword.id);
      results.push({ keywordId: keyword.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ keywordId: keyword.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ results });
}
