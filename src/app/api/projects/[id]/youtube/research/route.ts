import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchVideos } from "@/lib/providers/youtube";
import { LOCATION_GL } from "@/lib/locations";

export const maxDuration = 30;

// Estrategia > Videos: what already performs on YouTube for a keyword.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const body = await req.json();
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 100) : "";
  if (!query) return NextResponse.json({ error: "Escribe una palabra clave" }, { status: 400 });

  try {
    const videos = await searchVideos(query, {
      languageCode: project.languageCode,
      regionCode: LOCATION_GL[project.locationCode],
    });
    const research = { query, videos, searchedAt: new Date().toISOString() };
    await prisma.project.update({ where: { id: project.id }, data: { youtubeResearchJson: JSON.stringify(research) } });
    return NextResponse.json({ research });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.project.update({ where: { id: params.id }, data: { youtubeResearchJson: null } });
  return NextResponse.json({ ok: true });
}
