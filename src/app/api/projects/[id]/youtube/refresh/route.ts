import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveChannel, fetchRecentVideos } from "@/lib/providers/youtube";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project?.youtubeChannelId) {
    return NextResponse.json(
      { error: "Este proyecto no tiene un canal de YouTube conectado" },
      { status: 400 }
    );
  }

  try {
    const channel = await resolveChannel(project.youtubeChannelId);
    const videos = channel.uploadsPlaylistId
      ? await fetchRecentVideos(channel.uploadsPlaylistId, 10)
      : [];

    await prisma.project.update({
      where: { id: project.id },
      data: {
        youtubeChannelTitle: channel.title,
        youtubeDescription: channel.description,
        youtubeCountry: channel.country,
        youtubeChannelPublishedAt: channel.publishedAt ? new Date(channel.publishedAt) : null,
        youtubeThumbnailUrl: channel.thumbnailUrl,
        youtubeSubscribers: channel.subscribers,
        youtubeViews: channel.views,
        youtubeVideoCount: channel.videoCount,
        youtubeRecentVideosJson: JSON.stringify(videos),
        youtubeUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
