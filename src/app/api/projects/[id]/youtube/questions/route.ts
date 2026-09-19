import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAudienceQuestions } from "@/lib/providers/youtube";

export const maxDuration = 30;

// Questions viewers asked in the comments of the channel's most-viewed videos.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project?.youtubeChannelId) {
    return NextResponse.json({ error: "Conecta tu canal de YouTube en Conexiones primero" }, { status: 400 });
  }
  const videos: { videoId: string; title: string; viewCount?: number }[] = project.youtubeRecentVideosJson
    ? JSON.parse(project.youtubeRecentVideosJson)
    : [];
  const top = [...videos].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0)).slice(0, 6);
  try {
    const questions = await fetchAudienceQuestions(top);
    const data = { questions, updatedAt: new Date().toISOString() };
    await prisma.project.update({ where: { id: project.id }, data: { youtubeQuestionsJson: JSON.stringify(data) } });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
