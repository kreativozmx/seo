import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveChannel, fetchRecentVideos } from "@/lib/providers/youtube";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { input } = body;
  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  try {
    const channel = await resolveChannel(input);
    const videos = channel.uploadsPlaylistId
      ? await fetchRecentVideos(channel.uploadsPlaylistId, 30)
      : [];

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        youtubeChannelId: channel.channelId,
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

    return NextResponse.json({ ok: true, channelTitle: updated.youtubeChannelTitle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
