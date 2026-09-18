import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WEEKLY_EMAIL_SECTIONS } from "@/lib/weeklyEmail";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const data: { weeklyEmailEnabled?: boolean; weeklyEmailSectionsJson?: string } = {};

  if (typeof body.enabled === "boolean") {
    data.weeklyEmailEnabled = body.enabled;
  }
  if (Array.isArray(body.sections)) {
    const sections = body.sections.filter((s: string) =>
      (WEEKLY_EMAIL_SECTIONS as readonly string[]).includes(s)
    );
    data.weeklyEmailSectionsJson = JSON.stringify(sections);
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
  });

  return NextResponse.json({
    weeklyEmailEnabled: updated.weeklyEmailEnabled,
    weeklyEmailSectionsJson: updated.weeklyEmailSectionsJson,
  });
}
