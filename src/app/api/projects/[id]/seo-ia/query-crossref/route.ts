import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchQueriesForPages } from "@/lib/providers/gsc";

export const maxDuration = 60;

// Cross-references the pages AI assistants send traffic to (from GA4, see
// /api/projects/[id]/ga/refresh-stats) against real Google Search Console
// queries for those same pages — the closest available proxy for "what are
// people probably asking" when no AI platform shares actual chat prompts.
export async function POST(
  _req: NextRequest,
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

  const landingPages: { path: string; sessions: number }[] = project.gaAiLandingPagesJson
    ? JSON.parse(project.gaAiLandingPagesJson)
    : [];
  if (landingPages.length === 0) {
    return NextResponse.json(
      { error: "Aun no hay paginas de aterrizaje de IA (actualiza Analytics primero)" },
      { status: 400 }
    );
  }

  try {
    const client = oauthClientWithRefreshToken(project.gscRefreshToken);
    const paths = landingPages.map((p) => p.path.split("?")[0]);
    const crossRef = await fetchQueriesForPages(client, project.gscSiteUrl, paths, 28, 5);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        aiQueryCrossRefJson: JSON.stringify(crossRef),
        aiQueryCrossRefUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ crossRef });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
