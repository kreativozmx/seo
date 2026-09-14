import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateYoutubeSuggestions } from "@/lib/providers/openai";

interface StoredVideo {
  videoId: string;
  title: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  aiTitles?: string[];
  aiDescription?: string;
  aiSuggestedAt?: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; videoId: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      keywords: { where: { archivedAt: null }, take: 8, orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const videos: StoredVideo[] = project.youtubeRecentVideosJson
    ? JSON.parse(project.youtubeRecentVideosJson)
    : [];
  const video = videos.find((v) => v.videoId === params.videoId);
  if (!video) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  try {
    const suggestions = await generateYoutubeSuggestions({
      title: video.title,
      description: video.description ?? "",
      keywords: project.keywords.map((k) => k.text),
    });

    video.aiTitles = suggestions.titles;
    video.aiDescription = suggestions.description;
    video.aiSuggestedAt = new Date().toISOString();

    await prisma.project.update({
      where: { id: project.id },
      data: { youtubeRecentVideosJson: JSON.stringify(videos) },
    });

    return NextResponse.json({ video });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
