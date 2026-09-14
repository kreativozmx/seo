import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectDashboard from "@/components/ProjectDashboard";
import { computeProjectStats } from "@/lib/projectStats";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    gscConnected?: string;
    gscError?: string;
    gaConnected?: string;
    gaError?: string;
    gbpConnected?: string;
    gbpError?: string;
    shopifyConnected?: string;
    shopifyError?: string;
    shopifyNeedsShopDomain?: string;
  };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
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

  // Never send OAuth refresh tokens to the client.
  const serialized = JSON.parse(JSON.stringify(project));
  delete serialized.gscRefreshToken;
  delete serialized.gaRefreshToken;
  delete serialized.gbpRefreshToken;
  delete serialized.shopifyAccessToken;

  return (
    <ProjectDashboard
      project={serialized}
      stats={stats}
      gscConnected={searchParams.gscConnected === "1"}
      gscError={searchParams.gscError}
      gaConnected={searchParams.gaConnected === "1"}
      gaError={searchParams.gaError}
    />
  );
}
