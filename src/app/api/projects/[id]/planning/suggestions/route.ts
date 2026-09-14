import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchKeywordSuggestions } from "@/lib/providers/dataforseoLabs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { seedKeyword } = body;
  if (!seedKeyword) {
    return NextResponse.json({ error: "seedKeyword is required" }, { status: 400 });
  }

  try {
    const suggestions = await fetchKeywordSuggestions(
      seedKeyword,
      project.locationCode,
      project.languageCode,
      40
    );
    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
