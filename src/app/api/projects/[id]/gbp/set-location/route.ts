import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { locationName } = body;
  if (!locationName) {
    return NextResponse.json(
      { error: "locationName is required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: { gbpLocationName: String(locationName).trim() },
  });

  return NextResponse.json({ gbpLocationName: project.gbpLocationName });
}
