import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uptimeRecipients } from "@/lib/uptime";

const HOUR = 60 * 60 * 1000;
// range -> [total window in hours, number of buckets drawn in the bar strip]
const RANGES: Record<string, [number, number]> = {
  "24h": [24, 48],
  "7d": [24 * 7, 84],
  "30d": [24 * 30, 90],
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const [hours, bucketCount] = RANGES[req.nextUrl.searchParams.get("range") ?? "24h"] ?? RANGES["24h"];
  const now = Date.now();
  const windowStart = now - hours * HOUR;
  const bucketMs = (hours * HOUR) / bucketCount;

  const checks = await prisma.uptimeCheck.findMany({
    where: { projectId: params.id, checkedAt: { gte: new Date(windowStart) } },
    orderBy: { checkedAt: "asc" },
  });

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: new Date(windowStart + i * bucketMs).toISOString(),
    checks: 0,
    failures: 0,
  }));
  let upCount = 0;
  let msSum = 0;
  let msCount = 0;
  for (const c of checks) {
    const idx = Math.min(bucketCount - 1, Math.floor((c.checkedAt.getTime() - windowStart) / bucketMs));
    buckets[idx].checks++;
    if (c.up) upCount++;
    else buckets[idx].failures++;
    if (c.up && c.responseMs != null) {
      msSum += c.responseMs;
      msCount++;
    }
  }

  const incidents = await prisma.uptimeIncident.findMany({
    where: { projectId: params.id },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    uptimeEnabled: project.uptimeEnabled,
    uptimeStatus: project.uptimeStatus,
    uptimeLastCheckedAt: project.uptimeLastCheckedAt,
    uptimeEmailsJson: project.uptimeEmailsJson,
    uptimeUseReportEmail: project.uptimeUseReportEmail,
    recipients: uptimeRecipients(project),
    buckets,
    totalChecks: checks.length,
    uptimePct: checks.length > 0 ? (upCount / checks.length) * 100 : null,
    avgResponseMs: msCount > 0 ? Math.round(msSum / msCount) : null,
    incidents,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: {
    uptimeEnabled?: boolean;
    uptimeEmailsJson?: string | null;
    uptimeUseReportEmail?: boolean;
  } = {};

  if (typeof body.enabled === "boolean") {
    // Only controls email alerts — checks are always recorded, so the
    // status/history must not be reset when alerts are toggled.
    data.uptimeEnabled = body.enabled;
  }
  if (typeof body.useReportEmail === "boolean") {
    data.uptimeUseReportEmail = body.useReportEmail;
  }
  if (Array.isArray(body.emails)) {
    const emails: string[] = Array.from(
      new Set(
        body.emails
          .filter((e: unknown): e is string => typeof e === "string")
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    if (emails.some((e) => !EMAIL_RE.test(e))) {
      return NextResponse.json({ error: "Correo invalido" }, { status: 400 });
    }
    data.uptimeEmailsJson = emails.length > 0 ? JSON.stringify(emails) : null;
  }

  const updated = await prisma.project.update({ where: { id: params.id }, data });
  return NextResponse.json({
    uptimeEnabled: updated.uptimeEnabled,
    uptimeEmailsJson: updated.uptimeEmailsJson,
    uptimeUseReportEmail: updated.uptimeUseReportEmail,
    recipients: uptimeRecipients(updated),
  });
}
