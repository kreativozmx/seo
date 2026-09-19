import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAccessToken, toTaskDTO } from "@/lib/tasks";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: params.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { comments: true } } },
    }),
    prisma.taskMember.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({
    tasks: tasks.map(toTaskDTO),
    members: await Promise.all(
      members.map(async (m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        accessToken: m.accessToken ?? (await ensureAccessToken(m.id)),
      }))
    ),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "El titulo es requerido" }, { status: 400 });

  const last = await prisma.task.findFirst({
    where: { projectId: params.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const task = await prisma.task.create({
    data: { projectId: params.id, title: title.slice(0, 300), position: (last?.position ?? -1) + 1 },
    include: { _count: { select: { comments: true } } },
  });
  return NextResponse.json({ task: toTaskDTO(task) }, { status: 201 });
}
