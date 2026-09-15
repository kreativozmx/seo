import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const entries = await prisma.shopifyChangelogEntry.findMany({
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ entries });
}
