import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { propertyId } = body;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: { gaPropertyId: String(propertyId).trim() },
  });

  return NextResponse.json({ gaPropertyId: project.gaPropertyId });
}
