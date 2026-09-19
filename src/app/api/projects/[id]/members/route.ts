import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newAccessToken, sendMemberInviteEmail } from "@/lib/tasks";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Correo invalido" }, { status: 400 });

  const exists = await prisma.taskMember.findUnique({
    where: { projectId_email: { projectId: params.id, email } },
  });
  if (exists) return NextResponse.json({ error: "Esa persona ya esta en el proyecto" }, { status: 409 });

  const member = await prisma.taskMember.create({
    data: { projectId: params.id, name: name.slice(0, 80), email, accessToken: newAccessToken() },
  });

  // Best-effort welcome email with their personal link.
  let emailed = false;
  try {
    await sendMemberInviteEmail({
      memberId: member.id,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
    });
    emailed = true;
  } catch {
    // the admin can still copy the link manually from the people list
  }
  return NextResponse.json(
    { member: { id: member.id, name: member.name, email: member.email, accessToken: member.accessToken }, emailed },
    { status: 201 }
  );
}
