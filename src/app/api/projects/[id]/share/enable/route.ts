import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { shareToken: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const shareToken = project.shareToken ?? randomBytes(24).toString("hex");

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: { shareToken },
    select: { shareToken: true },
  });

  return NextResponse.json({ shareToken: updated.shareToken });
}
