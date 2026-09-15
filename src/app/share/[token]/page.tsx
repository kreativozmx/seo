import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectDashboard from "@/components/ProjectDashboard";
import { computeProjectStats } from "@/lib/projectStats";

export const dynamic = "force-dynamic";

// Public read-only view of a single project — no login. Only reachable by
// whoever has the exact share link (a random 48-char token), which the
// project owner generates and hands out from the "Configuracion" tab.
export default async function SharedProjectPage({
  params,
}: {
  params: { token: string };
}) {
  const project = await prisma.project.findUnique({
    where: { shareToken: params.token },
    include: {
      competitors: true,
      keywords: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          rankings: {
            orderBy: { checkedAt: "desc" },
            take: 200,
          },
        },
      },
    },
  });

  if (!project) notFound();

  const stats = computeProjectStats(project.keywords, project.domain);

  // Strip everything a read-only viewer has no business seeing: OAuth
  // tokens, and the share token itself (not needed by the UI here).
  const serialized = JSON.parse(JSON.stringify(project));
  delete serialized.gscRefreshToken;
  delete serialized.gaRefreshToken;
  delete serialized.gbpRefreshToken;
  delete serialized.shopifyAccessToken;
  delete serialized.shareToken;

  return <ProjectDashboard project={serialized} stats={stats} readOnly />;
}
