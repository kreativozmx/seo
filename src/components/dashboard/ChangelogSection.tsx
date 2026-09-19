"use client";

import { useEffect, useState } from "react";

interface ChangelogEntryDTO {
  id: string;
  sourceUrl: string;
  title: string;
  titleEs: string;
  summaryEs: string;
  category: string;
  publishedAt: string;
}

// Shopify's official changelog, translated to Spanish. Project-independent, so
// it also backs the standalone /actualizaciones page linked from the top bar.
export function ChangelogSection() {
  const [entries, setEntries] = useState<ChangelogEntryDTO[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEntries() {
    const res = await fetch("/api/changelog");
    const data = await res.json();
    setEntries(data.entries ?? []);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/changelog/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Changelog de Shopify</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Novedades oficiales de Shopify (changelog.shopify.com), traducidas
            al español. Se actualiza solo todos los dias.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {syncing ? "Actualizando..." : "Actualizar ahora"}
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {entries === null ? (
        <p className="text-neutral-400 text-sm">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Aun no hay entradas. Dale clic a &ldquo;Actualizar ahora&rdquo; para traer las
          mas recientes.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[12px] uppercase tracking-wide bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-500">
                  {entry.category}
                </span>
                <span className="text-[12px] text-neutral-400">
                  {new Date(entry.publishedAt).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className="text-sm font-medium text-neutral-900">{entry.titleEs}</p>
              {entry.summaryEs && (
                <p className="text-neutral-600 text-sm mt-1">{entry.summaryEs}</p>
              )}
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#228449] hover:underline mt-2 inline-block"
              >
                Ver original en changelog.shopify.com ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
