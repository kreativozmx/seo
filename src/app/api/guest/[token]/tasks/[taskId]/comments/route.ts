import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberByToken, getOwnedTask } from "@/lib/guestAuth";

export async function GET(_req: NextRequest, { params }: { params: { token: string; taskId: string } }) {
  const member = await getMemberByToken(params.token);
  if (!member) return NextResponse.json({ error: "Enlace invalido" }, { status: 404 });
  if (!(await getOwnedTask(member.id, params.taskId))) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }
  const comments = await prisma.taskComment.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { token: string; taskId: string } }) {
  const member = await getMemberByToken(params.token);
  if (!member) return NextResponse.json({ error: "Enlace invalido" }, { status: 404 });
  if (!(await getOwnedTask(member.id, params.taskId))) {
    return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "El comentario esta vacio" }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: { taskId: params.taskId, authorName: member.name, body: text.slice(0, 5000) },
  });
  return NextResponse.json(
    { comment: { id: comment.id, authorName: comment.authorName, body: comment.body, createdAt: comment.createdAt.toISOString() } },
    { status: 201 }
  );
}
