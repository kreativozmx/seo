import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { text, engine = "google", device = "desktop", source = "manual" } = body;

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const keyword = await prisma.keyword.create({
    data: {
      projectId: params.id,
      text,
      engine,
      device,
      source,
    },
  });

  return NextResponse.json(keyword, { status: 201 });
}
