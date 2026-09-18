import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCompetitorSuggestions } from "@/lib/providers/dataforseoLabs";

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { competitors: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  try {
    const suggestions = await fetchCompetitorSuggestions(
      project.domain,
      project.locationCode,
      project.languageCode,
      20
    );

    const existing = new Set(project.competitors.map((c) => c.domain.toLowerCase()));
    const ownDomain = project.domain.toLowerCase();
    const filtered = suggestions.filter(
      (s) => s.domain !== ownDomain && !existing.has(s.domain)
    );

    return NextResponse.json({ suggestions: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
