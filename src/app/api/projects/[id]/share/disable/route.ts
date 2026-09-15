import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.update({
    where: { id: params.id },
    data: { shareToken: null },
  });
  return NextResponse.json({ ok: true });
}
