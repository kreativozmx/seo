import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { listGa4Properties } from "@/lib/providers/ga4";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project?.gaRefreshToken) {
    return NextResponse.json(
      { error: "Este proyecto no tiene Google Analytics conectado" },
      { status: 400 }
    );
  }

  try {
    const client = oauthClientWithRefreshToken(project.gaRefreshToken);
    const properties = await listGa4Properties(client);
    return NextResponse.json({ properties });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
