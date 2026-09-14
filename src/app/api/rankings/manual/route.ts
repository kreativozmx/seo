import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/domain";

// Lets you log a position/mention by hand for engines that don't have an
// automated provider wired up yet (SEMrush, Ahrefs, ChatGPT, Perplexity...).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keywordId, domain, position, url, aiMentioned, snippet, source } =
    body;

  if (!keywordId || !domain) {
    return NextResponse.json(
      { error: "keywordId and domain are required" },
      { status: 400 }
    );
  }

  const ranking = await prisma.ranking.create({
    data: {
      keywordId,
      domain: normalizeDomain(domain),
      position: position ?? null,
      url: url || null,
      source: source || "manual",
      aiMentioned: aiMentioned ?? null,
      snippet: snippet || null,
    },
  });

  return NextResponse.json(ranking, { status: 201 });
}
