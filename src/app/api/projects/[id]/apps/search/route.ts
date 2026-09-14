import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchGooglePlayApps, searchAppleApps } from "@/lib/providers/appData";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const query: string = (body.query || project.name || "").trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const errors: string[] = [];
  let google: Awaited<ReturnType<typeof searchGooglePlayApps>> = [];
  let apple: Awaited<ReturnType<typeof searchAppleApps>> = [];

  try {
    google = await searchGooglePlayApps(query, project.locationCode, project.languageCode);
  } catch (err) {
    errors.push(err instanceof Error ? `Google Play: ${err.message}` : "Error en Google Play");
  }

  try {
    apple = await searchAppleApps(query, project.locationCode, project.languageCode);
  } catch (err) {
    errors.push(err instanceof Error ? `App Store: ${err.message}` : "Error en App Store");
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      appQuery: query,
      appsResultsJson: JSON.stringify({ google, apple }),
      appsCheckedAt: new Date(),
    },
  });

  return NextResponse.json({ project: updated, google, apple, errors });
}
