"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshGscStatsButton({
  projectIds,
}: {
  projectIds: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await Promise.all(
        projectIds.map((id) =>
          fetch(`/api/projects/${id}/gsc/refresh-stats`, { method: "POST" })
        )
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (projectIds.length === 0) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 rounded-full px-3 py-1.5 transition-colors"
    >
      {loading ? "Actualizando..." : "Actualizar metricas de GSC"}
    </button>
  );
}
