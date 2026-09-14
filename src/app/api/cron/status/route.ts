import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const lastRun = await prisma.cronRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ lastRun });
}
