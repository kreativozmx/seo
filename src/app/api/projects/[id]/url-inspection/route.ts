import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchPagesForRange, inspectUrl, UrlInspection } from "@/lib/providers/gsc";

export const maxDuration = 60;

const MAX_PER_RUN = 10;
const MAX_STORED = 30;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Inspects specific URLs (body.urls) or, by default, the homepage plus the
// site's top pages by clicks over the last 28 days. Results are merged into
// the cached list so previous inspections of other URLs are kept.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (!project.gscRefreshToken || !project.gscSiteUrl) {
    return NextResponse.json({ error: "Conecta Search Console para inspeccionar URLs" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const client = oauthClientWithRefreshToken(project.gscRefreshToken);

  let urls: string[] = Array.isArray(body.urls)
    ? body.urls.filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim())).map((u: string) => u.trim())
    : [];

  if (urls.length === 0) {
    const home = project.gscSiteUrl.startsWith("sc-domain:")
      ? `https://${project.domain}/`
      : project.gscSiteUrl;
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const start = new Date(end);
    start.setDate(start.getDate() - 27);
    const pages = await fetchPagesForRange(client, project.gscSiteUrl, fmtDate(start), fmtDate(end), 30).catch(() => []);
    urls = [home, ...pages.map((p) => p.page)];
  }
  urls = Array.from(new Set(urls)).slice(0, MAX_PER_RUN);

  // Small batches keep well under the per-minute quota.
  const results: UrlInspection[] = [];
  for (let i = 0; i < urls.length; i += 5) {
    results.push(...(await Promise.all(urls.slice(i, i + 5).map((u) => inspectUrl(client, project.gscSiteUrl as string, u, project.languageCode)))));
  }

  const previous: UrlInspection[] = project.urlInspectionsJson ? JSON.parse(project.urlInspectionsJson) : [];
  const fresh = new Set(results.map((r) => r.url));
  const merged = [...results, ...previous.filter((p) => !fresh.has(p.url))].slice(0, MAX_STORED);

  await prisma.project.update({
    where: { id: project.id },
    data: { urlInspectionsJson: JSON.stringify(merged), urlInspectionsUpdatedAt: new Date() },
  });
  return NextResponse.json({ inspections: merged });
}
