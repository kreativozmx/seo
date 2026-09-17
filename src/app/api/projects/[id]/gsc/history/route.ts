import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchSiteHistory } from "@/lib/providers/gsc";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (!project.gscRefreshToken || !project.gscSiteUrl) {
    return NextResponse.json(
      { error: "Este proyecto no tiene Search Console conectado" },
      { status: 400 }
    );
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? "90");

  try {
    const client = oauthClientWithRefreshToken(project.gscRefreshToken);
    const points = await fetchSiteHistory(client, project.gscSiteUrl, days);
    return NextResponse.json({ points });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
