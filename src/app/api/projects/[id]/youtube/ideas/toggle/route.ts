import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Checks/unchecks one saved video-title idea (by its index in the stored list).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { index, done } = await req.json();
  if (!Number.isInteger(index) || typeof done !== "boolean") {
    return NextResponse.json({ error: "index y done requeridos" }, { status: 400 });
  }
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { youtubeIdeasJson: true },
  });
  const ideas: { title: string; why?: string; done?: boolean }[] = project?.youtubeIdeasJson
    ? JSON.parse(project.youtubeIdeasJson)
    : [];
  if (index < 0 || index >= ideas.length) {
    return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
  }
  ideas[index] = { ...ideas[index], done };
  await prisma.project.update({ where: { id: params.id }, data: { youtubeIdeasJson: JSON.stringify(ideas) } });
  return NextResponse.json({ ok: true });
}
