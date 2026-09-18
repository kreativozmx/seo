import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDomainIntersection } from "@/lib/providers/dataforseoLabs";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Falta el dominio del competidor" }, { status: 400 });
  }

  try {
    const keywords = await fetchDomainIntersection(
      project.domain,
      domain,
      project.locationCode,
      project.languageCode,
      100
    );
    return NextResponse.json({ keywords });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
