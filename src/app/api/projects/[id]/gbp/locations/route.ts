import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { listGbpLocations } from "@/lib/providers/businessProfile";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project?.gbpRefreshToken) {
    return NextResponse.json(
      { error: "Este proyecto no tiene Business Profile conectado" },
      { status: 400 }
    );
  }

  try {
    const client = oauthClientWithRefreshToken(project.gbpRefreshToken);
    const locations = await listGbpLocations(client);
    return NextResponse.json({ locations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
