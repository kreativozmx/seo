"use client";

import { useEffect, useState } from "react";
import { ExpertBanner } from "@/components/dashboard/shared";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  operational: { label: "Operativo", className: "bg-[#E6F4EC] text-[#155D34]" },
  degraded_performance: { label: "Rendimiento degradado", className: "bg-amber-50 text-amber-700" },
  partial_outage: { label: "Falla parcial", className: "bg-amber-50 text-amber-700" },
  major_outage: { label: "Falla mayor", className: "bg-red-50 text-red-700" },
  under_maintenance: { label: "En mantenimiento", className: "bg-neutral-100 text-neutral-500" },
};

const INDICATOR_LABELS: Record<string, { label: string; className: string }> = {
  none: { label: "Todos los sistemas operativos", className: "bg-[#E6F4EC] text-[#155D34] border-[#155D34]/20" },
  minor: { label: "Problema menor detectado", className: "bg-amber-50 text-amber-700 border-amber-200" },
  major: { label: "Problema mayor detectado", className: "bg-red-50 text-red-700 border-red-200" },
  critical: { label: "Falla critica detectada", className: "bg-red-50 text-red-700 border-red-200" },
};

interface ShopifyStatusComponentRow {
  name: string;
  status: string;
}
interface ShopifyStatusIncidentRow {
  id: string;
  name: string;
  status: string;
  impact: string;
  shortlink: string;
  updatedAt: string;
  latestUpdateBody: string | null;
}

// Monitoreo tab — real, live status of the Shopify platform itself (not
// this specific store), from shopifystatus.com's public Statuspage API —
// no key needed, no Shopify Admin access required.
export function ShopifyStatusSection() {
  const [data, setData] = useState<{
    indicator: string;
    description: string;
    components: ShopifyStatusComponentRow[];
    incidents: ShopifyStatusIncidentRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify-status");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al consultar el estado de Shopify");
      setData(json);
      setLastChecked(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar el estado de Shopify");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indicatorInfo = INDICATOR_LABELS[data?.indicator ?? "none"] ?? INDICATOR_LABELS.none;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Estado de Shopify</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Estado en vivo de la plataforma de Shopify (no de tu tienda especifica) — util
              para saber si un problema que ves es de Shopify en general antes de investigar
              tu propia configuracion. Fuente:{" "}
              <a
                href="https://www.shopifystatus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#228449] hover:underline"
              >
                shopifystatus.com
              </a>
              .
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {loading ? "Consultando..." : "Actualizar"}
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        {data && (
          <>
            <div className={`mt-4 flex items-center gap-2 border rounded-lg px-3 py-2.5 text-sm font-medium ${indicatorInfo.className}`}>
              <span className="w-2 h-2 rounded-full bg-current shrink-0" />
              {indicatorInfo.label}
            </div>
            {lastChecked && (
              <p className="text-[13px] text-neutral-400 mt-1.5">
                Consultado {lastChecked.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}
              </p>
            )}

            {data.components.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                {data.components.map((c) => {
                  const info = STATUS_LABELS[c.status] ?? STATUS_LABELS.operational;
                  return (
                    <div
                      key={c.name}
                      className="flex items-center justify-between gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs text-neutral-700 truncate">{c.name}</span>
                      <span className={`text-[11px] rounded-md px-1.5 py-0.5 whitespace-nowrap shrink-0 ${info.className}`}>
                        {info.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {data && data.incidents.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
          <p className="text-sm font-medium text-neutral-900 mb-2">Incidentes activos</p>
          <div className="flex flex-col gap-2">
            {data.incidents.map((inc) => (
              <a
                key={inc.id}
                href={inc.shortlink}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-amber-50 border border-amber-100 hover:border-amber-200 rounded-lg px-3 py-2.5 transition-colors"
              >
                <p className="text-sm font-medium text-amber-800">{inc.name}</p>
                {inc.latestUpdateBody && (
                  <p className="text-xs text-amber-700/80 mt-1 line-clamp-2">{inc.latestUpdateBody}</p>
                )}
                <p className="text-[11px] text-amber-600 mt-1">
                  {new Date(inc.updatedAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <p className="text-sm font-medium text-neutral-900">¿Tu tienda esta fallando ahora mismo?</p>
        <p className="text-neutral-500 text-xs mt-0.5 mb-3">
          Si el estado arriba dice &quot;Todos los sistemas operativos&quot; pero tu ves un problema,
          probablemente no es una falla general de Shopify — sigue estos pasos antes de reportarlo.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <a
            href="https://help.shopify.com/es/questions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] text-white font-medium rounded-md px-3.5 py-2 transition-colors whitespace-nowrap"
          >
            Reportar a Shopify Support →
          </a>
          <a
            href="https://www.shopifystatus.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 font-medium rounded-md px-3.5 py-2 transition-colors whitespace-nowrap"
          >
            Ver historial completo de estado →
          </a>
        </div>

        <p className="text-[13px] font-medium text-neutral-700 mb-2">Antes de reportar, revisa:</p>
        <ul className="flex flex-col gap-1.5 mb-4">
          {[
            "Prueba en modo incognito o en otro navegador/dispositivo — descarta que sea cache o una extension tuya.",
            "Revisa si instalaste, actualizaste o desinstalaste una app o cambiaste de tema justo antes de que empezara el problema.",
            "Abre la consola del navegador (F12) en la pagina con el error y busca mensajes en rojo — suelen apuntar directo a la causa.",
            "Confirma si el problema es solo en tu tienda o tambien en otras tiendas Shopify que conozcas — si es solo la tuya, no es una falla de la plataforma.",
            "Si el checkout esta afectado, avisa a tus clientes por redes sociales mientras se resuelve, para evitar quejas o pedidos duplicados.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-600">
              <span className="text-neutral-400 shrink-0 mt-0.5">•</span>
              {tip}
            </li>
          ))}
        </ul>

        <ExpertBanner />
      </div>
    </div>
  );
}
