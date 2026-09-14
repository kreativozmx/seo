import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface AppResult {
  appId: string;
  title: string;
  icon: string | null;
  rating: number | null;
  reviewsCount: number | null;
  url: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { platform, appId } = body as { platform: "google" | "apple"; appId: string };
  if (!platform || !appId) {
    return NextResponse.json({ error: "platform y appId son requeridos" }, { status: 400 });
  }

  const cached: { google?: AppResult[]; apple?: AppResult[] } = project.appsResultsJson
    ? JSON.parse(project.appsResultsJson)
    : {};
  const list = platform === "google" ? cached.google ?? [] : cached.apple ?? [];
  const app = list.find((a) => a.appId === appId);
  if (!app) {
    return NextResponse.json({ error: "App no encontrada en la ultima busqueda" }, { status: 404 });
  }

  const data =
    platform === "google"
      ? {
          googlePlayAppId: app.appId,
          googlePlayAppTitle: app.title,
          googlePlayAppIcon: app.icon,
          googlePlayAppRating: app.rating,
          googlePlayAppReviews: app.reviewsCount,
          googlePlayAppUrl: app.url,
        }
      : {
          appleAppId: app.appId,
          appleAppTitle: app.title,
          appleAppIcon: app.icon,
          appleAppRating: app.rating,
          appleAppReviews: app.reviewsCount,
          appleAppUrl: app.url,
        };

  const updated = await prisma.project.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}
