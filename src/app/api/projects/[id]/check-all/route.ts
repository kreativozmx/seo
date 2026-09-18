import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkKeywordNow } from "@/lib/rankingCheck";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const keywords = await prisma.keyword.findMany({
    where: {
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
