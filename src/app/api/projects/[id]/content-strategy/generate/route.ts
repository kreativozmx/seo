import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchTopQueries } from "@/lib/providers/gsc";
import { generateContentIdeas } from "@/lib/providers/openai";

// Estrategia > Contenidos: 12 blog title ideas based on real Search
// Console queries from the last 7 days, aimed at helping the domain rank.
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

  try {
    const client = oauthClientWithRefreshToken(project.gscRefreshToken);
    const queries = await fetchTopQueries(client, project.gscSiteUrl, 7, 100);

    if (queries.length === 0) {
      return NextResponse.json(
        {
          error:
            "No hay busquedas registradas en Search Console en los ultimos 7 dias para este sitio.",
        },
        { status: 400 }
      );
    }

    const ideas = await generateContentIdeas({ domain: project.domain, queries });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        contentIdeasJson: JSON.stringify(ideas),
        contentIdeasUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ ideas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
