import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Marks/unmarks one content idea as already written by the user.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { index, done } = body;
  if (typeof index !== "number" || typeof done !== "boolean") {
    return NextResponse.json(
      { error: "index (number) and done (boolean) are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { contentIdeasJson: true },
  });
  if (!project?.contentIdeasJson) {
    return NextResponse.json({ error: "Proyecto sin ideas de contenido" }, { status: 404 });
  }

  const ideas: { title: string; keywords: string[]; done?: boolean }[] = JSON.parse(
    project.contentIdeasJson
  );
  if (index < 0 || index >= ideas.length) {
    return NextResponse.json({ error: "Indice invalido" }, { status: 400 });
  }

  ideas[index] = { ...ideas[index], done };

  await prisma.project.update({
    where: { id: params.id },
    data: { contentIdeasJson: JSON.stringify(ideas) },
  });

  return NextResponse.json({ ok: true });
}
