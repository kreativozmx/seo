import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateYoutubeTitleIdeas } from "@/lib/providers/openai";
import { VIDEO_TYPES } from "@/lib/videoTypes";

export const maxDuration = 60;

// Estrategia > Videos: title ideas for new videos, based on the channel's
// current videos + a chosen video type and virality level (1-5).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (!project.youtubeChannelId) {
    return NextResponse.json({ error: "Conecta tu canal de YouTube en Conexiones primero" }, { status: 400 });
  }

  const body = await req.json();
  const type = VIDEO_TYPES.find((t) => t.id === body.videoType);
  const virality = Number(body.virality);
  if (!type) {
    return NextResponse.json({ error: "Tipo de video invalido" }, { status: 400 });
  }
  const videoType = type.promptName;
  if (!Number.isInteger(virality) || virality < 1 || virality > 5) {
    return NextResponse.json({ error: "El nivel de viralidad debe ser de 1 a 5" }, { status: 400 });
  }

  try {
    const videos: { title?: string; viewCount?: number }[] = project.youtubeRecentVideosJson
      ? JSON.parse(project.youtubeRecentVideosJson)
      : [];
    const previous: { title: string; topic?: string; why?: string; done?: boolean }[] = project.youtubeIdeasJson
      ? JSON.parse(project.youtubeIdeasJson)
      : [];
    const research: { query: string; videos: { title: string; viewCount: number }[] } | null = project.youtubeResearchJson
      ? JSON.parse(project.youtubeResearchJson)
      : null;
    const questionsData: { questions: { question: string }[] } | null = project.youtubeQuestionsJson
      ? JSON.parse(project.youtubeQuestionsJson)
      : null;
    const generated = await generateYoutubeTitleIdeas({
      channelTitle: project.youtubeChannelTitle ?? project.name,
      channelDescription: project.youtubeDescription,
      videos: videos.map((v) => ({ title: v.title ?? "", views: v.viewCount ?? 0 })),
      videoType,
      virality,
      languageCode: project.languageCode,
      count: 5,
      avoidTitles: previous.map((p) => p.title),
      competitorVideos: research?.videos.map((v) => ({ title: v.title, views: v.viewCount })) ?? [],
      researchQuery: research?.query,
      audienceQuestions: questionsData?.questions.map((q) => q.question) ?? [],
    });

    // Checked ideas are kept (so the user's progress isn't lost); unchecked
    // ones from the previous batch are replaced by the new batch.
    const ideas = [
      ...previous.filter((p) => p.done).map((p) => ({ title: p.title, topic: p.topic ?? "", why: p.why ?? "", done: true })),
      ...generated.map((g) => ({ ...g, done: false })),
    ];

    await prisma.project.update({
      where: { id: project.id },
      data: {
        youtubeIdeasJson: JSON.stringify(ideas),
        youtubeIdeasOptionsJson: JSON.stringify({ videoType: type.id, virality, languageCode: project.languageCode }),
        youtubeIdeasUpdatedAt: new Date(),
      },
    });
    return NextResponse.json({ ideas });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
