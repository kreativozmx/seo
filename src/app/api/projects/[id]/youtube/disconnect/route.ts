import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.update({
    where: { id: params.id },
    data: {
      youtubeChannelId: null,
      youtubeChannelTitle: null,
      youtubeDescription: null,
      youtubeCountry: null,
      youtubeChannelPublishedAt: null,
      youtubeThumbnailUrl: null,
      youtubeSubscribers: null,
      youtubeViews: null,
      youtubeVideoCount: null,
      youtubeRecentVideosJson: null,
      youtubeUpdatedAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
