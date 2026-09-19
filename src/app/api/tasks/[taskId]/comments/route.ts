import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { taskId: string } }) {
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

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  const task = await prisma.task.findUnique({ where: { id: params.taskId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "El comentario esta vacio" }, { status: 400 });

  // Single-admin app: comments are authored by the logged-in account.
  const comment = await prisma.taskComment.create({
    data: { taskId: task.id, authorName: process.env.AUTH_EMAIL || "Admin", body: text.slice(0, 5000) },
  });
  return NextResponse.json(
    { comment: { id: comment.id, authorName: comment.authorName, body: comment.body, createdAt: comment.createdAt.toISOString() } },
    { status: 201 }
  );
}
