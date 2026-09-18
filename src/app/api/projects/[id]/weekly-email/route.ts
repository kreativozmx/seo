import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const enabled = Boolean(body.enabled);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { weeklyEmailEnabled: enabled },
  });

  return NextResponse.json({ weeklyEmailEnabled: updated.weeklyEmailEnabled });
}
