import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewProjectForm from "@/components/NewProjectForm";
import RefreshGscStatsButton from "@/components/RefreshGscStatsButton";
import { computeProjectStats } from "@/lib/projectStats";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface-low rounded-xl px-4 py-3.5 shadow-elevation-1">
      <p className="text-[11px] text-neutral-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-neutral-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default async function Home() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      competitors: true,
      _count: { select: { keywords: true, competitors: true } },
      keywords: {
        where: { archivedAt: null },
        include: {
          rankings: {
            orderBy: { checkedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  const withStats = projects.map((project) => ({
    project,
    stats: computeProjectStats(project.keywords, project.domain),
  }));

  const totalKeywords = withStats.reduce(
    (sum, p) => sum + p.stats.trackedKeywords,
    0
  );
  const allPositions = withStats.flatMap(({ stats }) =>
    stats.avgPosition != null
      ? Array(stats.withPosition).fill(stats.avgPosition)
      : []
  );
  const totalTop10 = withStats.reduce((sum, p) => sum + p.stats.top10, 0);
  const totalTop3 = withStats.reduce((sum, p) => sum + p.stats.top3, 0);

  const gscConnectedProjects = projects.filter((p) => p.gscSiteUrl);
  const totalClicks = gscConnectedProjects.reduce(
    (sum, p) => sum + (p.gscClicks28d ?? 0),
    0
  );
  const totalImpressions = gscConnectedProjects.reduce(
    (sum, p) => sum + (p.gscImpressions28d ?? 0),
    0
  );

  const overallAvgPosition =
    allPositions.length > 0
      ? (
          allPositions.reduce((a, b) => a + b, 0) / allPositions.length
        ).toFixed(1)
      : "—";

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Shopify Audit
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Resumen de posiciones y visibilidad de todos tus proyectos.
          </p>
        </div>
        <RefreshGscStatsButton
          projectIds={gscConnectedProjects.map((p) => p.id)}
        />
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <StatCard label="Proyectos" value={String(projects.length)} />
        <StatCard label="Keywords" value={String(totalKeywords)} />
        <StatCard label="Posicion prom." value={overallAvgPosition} />
        <StatCard label="En Top 3" value={String(totalTop3)} />
        <StatCard label="En Top 10" value={String(totalTop10)} />
        <StatCard
          label="Clics GSC (28d)"
          value={totalClicks.toLocaleString("es-MX")}
          hint={`${totalImpressions.toLocaleString("es-MX")} impresiones`}
        />
      </section>

      <section className="mb-8">
        <NewProjectForm />
      </section>

      <section className="flex flex-col gap-2">
        {projects.length === 0 && (
          <p className="text-neutral-400 text-sm">
            Aun no hay proyectos. Crea el primero arriba.
          </p>
        )}
        {withStats.map(({ project, stats }) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="flex items-center justify-between bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-sm rounded-xl px-4 py-3.5 transition-all flex-wrap gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900 truncate">
                  {project.name}
                </p>
                <p className="text-neutral-500 text-sm truncate">
                  {project.domain}
                </p>
              </div>
              <span
                className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 ${
                  project.gscSiteUrl
                    ? "bg-blue-50 text-blue-600"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {project.gscSiteUrl ? "GSC conectado" : "Sin GSC"}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-neutral-500 shrink-0">
              <span>{project._count.keywords} keywords</span>
              <span>
                Pos. prom.{" "}
                <strong className="text-neutral-700">
                  {stats.avgPosition != null
                    ? stats.avgPosition.toFixed(1)
                    : "—"}
                </strong>
              </span>
              <span className="text-emerald-600">{stats.top10} en top10</span>
              {project.gscSiteUrl && (
                <span>
                  {(project.gscClicks28d ?? 0).toLocaleString("es-MX")} clics
                </span>
              )}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
