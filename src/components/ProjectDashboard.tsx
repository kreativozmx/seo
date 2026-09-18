"use client";

import { Fragment, createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeywordDetailCard, KeywordListItem } from "@/components/KeywordCard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ProgressBar } from "@/components/ProgressBar";
import OrdersChart from "@/components/OrdersChart";
import SalesBreakdownChart from "@/components/SalesBreakdownChart";
import OrganicTrafficChart from "@/components/OrganicTrafficChart";
import CompetitorScatterChart, {
  CompetitorPoint,
  XMetricKey,
  X_METRICS,
  colorForCompetitorIndex,
} from "@/components/CompetitorScatterChart";
import { useSimulatedProgress } from "@/lib/useSimulatedProgress";
import { ProjectDTO, KeywordDTO } from "@/lib/types";
import { normalizeDomain } from "@/lib/domain";
import { LOCATIONS, LANGUAGES } from "@/lib/locations";
import { ProjectStats } from "@/lib/projectStats";
import { AUDIT_ITEMS } from "@/lib/auditItems";

// Where the "quiero que me ayude un experto" banner points. Change this to
// a contact page, WhatsApp link, or booking page whenever you decide —
// defaults to a mailto so it works out of the box.
const EXPERT_CONTACT_URL =
  process.env.NEXT_PUBLIC_EXPERT_CONTACT_URL ||
  "mailto:israel@kreativoz.com.mx?subject=Quiero%20ayuda%20con%20la%20velocidad%20de%20mi%20sitio";

// Small "?" badge with a native browser tooltip (title attribute) —
// used to explain jargon-y metrics (trafico organico, valor del trafico,
// etc.) to merchants who aren't SEO-savvy, without pulling in a tooltip
// library.
function InfoTooltip({ text }: { text: string }) {
  return (
    <span
      title={text}
      tabIndex={0}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neutral-200 text-neutral-500 text-[12px] font-semibold leading-none cursor-help shrink-0 align-middle"
    >
      ?
    </span>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-0.5 hover:text-neutral-600 transition-colors ${
        active ? "text-neutral-700 font-medium" : ""
      }`}
    >
      {label}
      <span className="text-[12px]">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );
}

function ConnectBanner({
  connected,
  error,
  label,
}: {
  connected?: boolean;
  error?: string;
  label: string;
}) {
  if (!connected && !error) return null;
  return (
    <p
      className={`mb-4 text-sm rounded-lg px-3 py-2 border ${
        error
          ? "text-red-700 border-red-200 bg-red-50"
          : "text-emerald-700 border-emerald-200 bg-emerald-50"
      }`}
    >
      {error || `${label} conectado correctamente.`}
    </p>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-4 py-3.5">
      <p className="text-[14px] text-neutral-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-semibold text-neutral-900 mt-1">{value}</p>
      {hint && <p className="text-[14px] text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

// Ahrefs-style overview card: a titled panel with a small grid of labeled
// stats inside, several of these sitting side by side in the Panel tab.
function OverviewPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function OverviewStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[13px] text-neutral-400">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${valueClassName ?? "text-neutral-900"}`}>{value}</p>
    </div>
  );
}

// Lets a long-running "Analizar"/"Actualizar" action (PageSpeed, ecommerce
// catalog scrape, competitor traffic overview, etc.) report progress from a
// deep child component up to a status pill that lives in the top bar —
// which never unmounts — so the indicator (and the in-flight fetch itself)
// survives the user switching tabs instead of forcing them to sit and wait
// on that one tab.
interface SyncStatusContextValue {
  begin: (key: string, label: string) => void;
  end: (key: string) => void;
}
const SyncStatusContext = createContext<SyncStatusContextValue>({
  begin: () => {},
  end: () => {},
});
function useSyncStatus() {
  return useContext(SyncStatusContext);
}

const NAV_ITEMS = [
  { id: "panel", label: "Panel" },
  { id: "auditoria", label: "Auditoria" },
  { id: "velocidad", label: "Velocidad" },
  { id: "analiticas", label: "Analiticas" },
  { id: "rankings", label: "Rankings" },
  { id: "seo-ia", label: "SEO IA" },
  { id: "youtube", label: "SEO Youtube" },
  { id: "planificacion", label: "Keywords" },
  { id: "changelog", label: "Actualizaciones Shopify" },
  { id: "contenidos", label: "Contenidos" },
  { id: "competencia", label: "Competencia" },
  { id: "monitoreo", label: "Monitoreo" },
  { id: "apps", label: "Apps iOS/Android", comingSoon: true },
  { id: "marketplaces", label: "Marketplaces", comingSoon: true },
  { id: "notificaciones", label: "Notificaciones", comingSoon: true },
  { id: "conexiones", label: "Conexiones" },
  { id: "configuracion", label: "Ajustes" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

// Sidebar layout only — groups related tabs together. `id: null` means the
// header itself has no content/tab of its own (just a label above its
// children), everything else renders as a normal clickable NavId.
const NAV_GROUPS: { id: NavId | null; label?: string; children?: NavId[] }[] = [
  { id: "panel" },
  { id: "auditoria", children: ["velocidad"] },
  { id: "analiticas" },
  { id: "rankings", children: ["seo-ia", "youtube"] },
  { id: null, label: "Planificacion", children: ["planificacion", "changelog"] },
  { id: null, label: "Estrategia", children: ["contenidos"] },
  { id: "competencia" },
  { id: "monitoreo" },
  { id: "apps" },
  { id: "marketplaces" },
  { id: "notificaciones" },
  { id: "conexiones" },
  { id: "configuracion" },
];

// Minimal line icons (GSC-style: 20px, single stroke) for the nav rail.
const NAV_ICON_PATHS: Record<NavId, React.ReactNode> = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  analiticas: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-5 3 3 5-7" />
    </>
  ),
  rankings: <path d="M4 19V10m6 9V4m6 15v-7m6 7V8" />,
  planificacion: (
    <>
      <path d="M12 2 3 11v2l9 9 9-9V2Z" />
      <circle cx="8" cy="7" r="1.4" />
    </>
  ),
  "seo-ia": (
    <>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <path d="M12 7V3m-4 8v2m8-2v2" />
      <circle cx="9" cy="13" r="1" />
      <circle cx="15" cy="13" r="1" />
    </>
  ),
  competencia: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20c0-3 2.5-5 6-5s6 2 6 5M15 20c0-2.2 1.6-4 4.5-4" />
    </>
  ),
  velocidad: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  monitoreo: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  youtube: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m10 9 5 3-5 3Z" />
    </>
  ),
  auditoria: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v2h6V3M8 9l1.5 1.5L12 8M8 14l1.5 1.5L12 13" />
      <path d="M14 9.5h3M14 14.5h3" />
    </>
  ),
  changelog: (
    <>
      <path d="M4 4h13l3 3v13H4Z" />
      <path d="M9 9h7M9 13h7M9 17h4" />
    </>
  ),
  contenidos: (
    <>
      <path d="M4 19.5V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v13.5" />
      <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19a2 2 0 0 0 2-2" />
      <path d="M8 8h8M8 12h5" />
    </>
  ),
  apps: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  marketplaces: (
    <>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M4 9h16v11H4Z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  notificaciones: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  conexiones: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.3 10.9 7.4-3.8M8.3 13.1l7.4 3.8" />
    </>
  ),
  configuracion: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
};

function NavIcon({ id }: { id: NavId }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {NAV_ICON_PATHS[id]}
    </svg>
  );
}

function NavButton({
  item,
  active,
  indent,
  onClick,
}: {
  item: { id: NavId; label: string; comingSoon?: boolean };
  active: boolean;
  indent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full text-left rounded-md whitespace-nowrap transition-colors ${
        indent ? "pl-7 pr-2.5 py-1 text-[13px]" : "px-2.5 py-1.5 text-[13px]"
      } ${
        active
          ? "text-[#228449] font-semibold"
          : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      <NavIcon id={item.id} />
      {item.label}
      {item.comingSoon && <ComingSoonBadge />}
    </button>
  );
}

function ComingSoonBadge() {
  return (
    <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 align-middle">
      Soon
    </span>
  );
}

function ComingSoonSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-neutral-50 border border-dashed border-neutral-300 rounded-xl px-4 py-8 flex flex-col items-center text-center gap-2">
      <span className="text-[13px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-md px-2 py-0.5">
        Soon
      </span>
      <p className="text-sm font-medium text-neutral-900 mt-1">{title}</p>
      <p className="text-neutral-500 text-xs max-w-md">{description}</p>
    </div>
  );
}

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
function ShopifyStatusSection() {
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

function SummaryTile({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`bg-white border border-neutral-200 rounded-lg px-4 py-3 text-left w-full ${
        onClick ? "hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer" : ""
      }`}
    >
      <p className="text-[14px] text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-neutral-900 mt-0.5">{value}</p>
      {hint && <p className="text-[14px] text-neutral-400 mt-0.5">{hint}</p>}
    </Comp>
  );
}

// A quick "at a glance" grid summarizing every connected tool/tab, each
// clickable to jump straight to that tab.
function PanelSummaryGrid({
  project,
  onNavigate,
}: {
  project: ProjectDTO;
  onNavigate: (id: NavId) => void;
}) {
  const tech: { name: string }[] = project.techDetectedJson ? JSON.parse(project.techDetectedJson) : [];
  const uniqueTech = new Set(tech.map((t) => t.name)).size;
  const platformLabel =
    project.ecommercePlatform === "shopify"
      ? "Shopify"
      : project.ecommercePlatform === "woocommerce"
      ? "WooCommerce"
      : "Sin detectar";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <SummaryTile
        label="Competidores"
        value={String(project.competitors.length)}
        hint="rastreados"
        onClick={() => onNavigate("competencia")}
      />
      <SummaryTile
        label="Tecnologias"
        value={project.techCheckedAt ? String(uniqueTech) : "—"}
        hint="detectadas"
        onClick={() => onNavigate("panel")}
      />
      <SummaryTile
        label="Velocidad"
        value={project.psiPerformanceScore != null ? String(project.psiPerformanceScore) : "—"}
        hint="rendimiento /100"
        onClick={() => onNavigate("velocidad")}
      />
      <SummaryTile
        label="Catalogo"
        value={platformLabel}
        hint={project.ecommerceProductCount != null ? `${project.ecommerceProductCount} productos` : undefined}
        onClick={() => onNavigate("auditoria")}
      />
      {project.youtubeChannelId && (
        <SummaryTile
          label="YouTube"
          value={(project.youtubeSubscribers ?? 0).toLocaleString("es-MX")}
          hint="suscriptores"
          onClick={() => onNavigate("youtube")}
        />
      )}
      {project.gaConnectedAt && (
        <SummaryTile
          label="Trafico organico"
          value={(project.gaSessionsOrganic28d ?? 0).toLocaleString("es-MX")}
          hint="sesiones (28d)"
          onClick={() => onNavigate("panel")}
        />
      )}
    </div>
  );
}

// Top 5 keywords by own position, best-first or worst-first.
function ChangeBadgeMini({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return <span className="text-neutral-300 text-xs">—</span>;
  const improved = delta < 0;
  return (
    <span className={`text-xs font-medium shrink-0 ${improved ? "text-emerald-600" : "text-red-500"}`}>
      {improved ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

function BestWorstKeywordsCard({
  title,
  keywords,
  ownDomain,
  order,
  limit = 5,
}: {
  title: string;
  keywords: KeywordDTO[];
  ownDomain: string;
  order: "best" | "worst" | "change";
  limit?: number;
}) {
  function ownHistory(keyword: KeywordDTO) {
    return keyword.rankings
      .filter((r) => r.domain === ownDomain && r.position != null)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  }

  const withPosition = keywords
    .map((k) => {
      const history = ownHistory(k);
      const current = history[0] ?? null;
      const previous = history[1]?.position ?? null;
      const change =
        current?.position != null && previous != null ? current.position - previous : null;
      return { keyword: k, ranking: current, change };
    })
    .filter((r) => r.ranking?.position != null) as {
    keyword: KeywordDTO;
    ranking: KeywordDTO["rankings"][number];
    change: number | null;
  }[];

  const pool = order === "change" ? withPosition.filter((r) => r.change != null) : withPosition;

  const sorted = [...pool].sort((a, b) => {
    if (order === "best") return (a.ranking.position as number) - (b.ranking.position as number);
    if (order === "worst") return (b.ranking.position as number) - (a.ranking.position as number);
    // change: biggest movers first, regardless of direction
    return Math.abs(b.change as number) - Math.abs(a.change as number);
  });
  const top = sorted.slice(0, limit);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900 mb-2">{title}</p>
      {top.length === 0 ? (
        <p className="text-xs text-neutral-400">
          {order === "change"
            ? "Aun no hay suficiente historial para calcular cambios."
            : "Aun no hay keywords con posicion rastreada."}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {top.map(({ keyword, ranking, change }) => (
            <div key={keyword.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-sm">
              <div className="min-w-0">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(keyword.text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buscar esta keyword en Google"
                  className="inline-flex items-center gap-1 text-neutral-700 hover:text-[#228449] hover:underline truncate"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-400">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <span className="truncate">{keyword.text}</span>
                </a>
                {ranking.url && (
                  <a
                    href={ranking.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-neutral-400 hover:text-[#228449] hover:underline truncate block"
                  >
                    {ranking.url.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {order === "change" && <ChangeBadgeMini delta={change} />}
                <PositionBadgeMini position={ranking.position} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PositionBadgeMini({ position }: { position: number | null }) {
  if (position == null) return <span className="text-neutral-400 text-xs">—</span>;
  const color =
    position <= 3 ? "text-emerald-600" : position <= 10 ? "text-amber-600" : "text-neutral-600";
  return <span className={`font-semibold text-xs shrink-0 ${color}`}>#{position}</span>;
}

interface ProjectListEntry {
  id: string;
  name: string;
  domain: string;
}

// Lets a merchant jump straight to another project without going back to
// the project list first. "sidebar" renders the full logo+name block used
// at the top of the nav rail; "breadcrumb" renders an Ahrefs-style inline
// "Proyecto ▾" trigger for the top breadcrumb bar.
function ProjectSwitcher({
  currentId,
  currentName,
  currentDomain,
  variant = "sidebar",
}: {
  currentId: string;
  currentName: string;
  currentDomain: string;
  variant?: "sidebar" | "breadcrumb";
}) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectListEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !projects && !loading) {
      setLoading(true);
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        setProjects(
          Array.isArray(data)
            ? data.map((p: ProjectListEntry) => ({ id: p.id, name: p.name, domain: p.domain }))
            : []
        );
      } finally {
        setLoading(false);
      }
    }
  }

  const filtered = (projects ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.domain.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative">
      {variant === "sidebar" ? (
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-100 transition-colors text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={26} height={26} className="shrink-0 rounded" />
          <div className="min-w-0 flex-1">
            <p className="text-neutral-900 text-[13px] font-medium truncate">{currentName}</p>
            <p className="text-neutral-400 text-[11px] truncate">{currentDomain}</p>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-neutral-400"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      ) : (
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-left min-w-0"
        >
          <span className="text-sm font-medium text-neutral-900 truncate max-w-[220px]">{currentName}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-neutral-400"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-40 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-neutral-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar proyecto..."
                className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-neutral-200 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {loading && <p className="px-3 py-2 text-xs text-neutral-400">Cargando...</p>}
              {!loading && filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-400">Sin resultados.</p>
              )}
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col px-3 py-2 text-[13px] hover:bg-neutral-50 transition-colors ${
                    p.id === currentId ? "bg-primary/5" : ""
                  }`}
                >
                  <span
                    className={`truncate ${
                      p.id === currentId ? "text-primary font-medium" : "text-neutral-800"
                    }`}
                  >
                    {p.name}
                  </span>
                  <span className="text-[11px] text-neutral-400 truncate">{p.domain}</span>
                </Link>
              ))}
            </div>
            <Link
              href="/"
              className="block px-3 py-2 text-[13px] text-neutral-500 hover:bg-neutral-50 border-t border-neutral-100 transition-colors"
            >
              Ver todos los proyectos
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProjectDashboard({
  project,
  stats,
  gscConnected,
  gscError,
  gaConnected,
  gaError,
  readOnly,
}: {
  project: ProjectDTO;
  stats: ProjectStats;
  gscConnected?: boolean;
  gscError?: string;
  gaConnected?: boolean;
  gaError?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NavId>("panel");

  // Lives here (not inside the section that starts the sync) specifically
  // so it survives the user switching tabs — see SyncStatusContext above.
  const [activeSyncs, setActiveSyncs] = useState<Record<string, string>>({});
  const syncStatus = useMemo<SyncStatusContextValue>(
    () => ({
      begin: (key, label) => setActiveSyncs((prev) => ({ ...prev, [key]: label })),
      end: (key) =>
        setActiveSyncs((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }),
    }),
    []
  );
  const activeSyncLabels = Object.values(activeSyncs);

  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(
    project.keywords[0]?.id ?? null
  );

  useEffect(() => {
    if (
      project.keywords.length > 0 &&
      !project.keywords.some((k) => k.id === selectedKeywordId)
    ) {
      setSelectedKeywordId(project.keywords[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.keywords]);

  const selectedKeyword =
    project.keywords.find((k) => k.id === selectedKeywordId) ?? null;

  const [keywordSortBy, setKeywordSortBy] = useState<
    "keyword" | "date" | "position" | "change" | "best"
  >("date");
  const [keywordSortDir, setKeywordSortDir] = useState<"asc" | "desc">("desc");

  function toggleKeywordSort(column: "keyword" | "date" | "position" | "change" | "best") {
    if (keywordSortBy === column) {
      setKeywordSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKeywordSortBy(column);
      setKeywordSortDir(column === "keyword" ? "asc" : "desc");
    }
  }

  function ownLatestRanking(keyword: (typeof project.keywords)[number]) {
    let latest: (typeof keyword.rankings)[number] | null = null;
    for (const r of keyword.rankings) {
      if (r.domain !== project.domain) continue;
      if (!latest || new Date(r.checkedAt) > new Date(latest.checkedAt)) latest = r;
    }
    return latest;
  }

  function ownHistory(keyword: (typeof project.keywords)[number]) {
    return keyword.rankings
      .filter((r) => r.domain === project.domain && r.position != null)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  }

  function ownChange(keyword: (typeof project.keywords)[number]) {
    const history = ownHistory(keyword);
    const current = history[0]?.position ?? null;
    const previous = history[1]?.position ?? null;
    if (current == null || previous == null) return null;
    return current - previous;
  }

  function ownBestPosition(keyword: (typeof project.keywords)[number]) {
    const history = ownHistory(keyword);
    if (history.length === 0) return null;
    return Math.min(...history.map((r) => r.position as number));
  }

  const sortedKeywords = [...project.keywords].sort((a, b) => {
    const dir = keywordSortDir === "asc" ? 1 : -1;
    if (keywordSortBy === "keyword") {
      return a.text.localeCompare(b.text) * dir;
    }
    const latestA = ownLatestRanking(a);
    const latestB = ownLatestRanking(b);
    if (keywordSortBy === "date") {
      const ta = latestA ? new Date(latestA.checkedAt).getTime() : -Infinity;
      const tb = latestB ? new Date(latestB.checkedAt).getTime() : -Infinity;
      return (ta - tb) * dir;
    }
    if (keywordSortBy === "change") {
      // Positive delta = worse (position number went up). Keywords with no
      // change data sort last regardless of direction.
      const ca = ownChange(a);
      const cb = ownChange(b);
      if (ca == null && cb == null) return 0;
      if (ca == null) return 1;
      if (cb == null) return -1;
      return (ca - cb) * dir;
    }
    if (keywordSortBy === "best") {
      const ba = ownBestPosition(a);
      const bb = ownBestPosition(b);
      if (ba == null && bb == null) return 0;
      if (ba == null) return 1;
      if (bb == null) return -1;
      return (ba - bb) * dir;
    }
    // position — keywords with no position sort last regardless of direction
    const pa = latestA?.position;
    const pb = latestB?.position;
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return (pa - pb) * dir;
  });

  const [checkedKeywordIds, setCheckedKeywordIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkChecking, setBulkChecking] = useState(false);
  const bulkCheckProgress = useSimulatedProgress();

  function toggleChecked(id: string) {
    setCheckedKeywordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    setCheckedKeywordIds((prev) =>
      prev.size === sortedKeywords.length ? new Set() : new Set(sortedKeywords.map((k) => k.id))
    );
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(checkedKeywordIds).map((id) =>
          fetch(`/api/keywords/${id}`, { method: "DELETE" })
        )
      );
      if (checkedKeywordIds.has(selectedKeywordId ?? "")) setSelectedKeywordId(null);
      setCheckedKeywordIds(new Set());
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkCheck() {
    setBulkChecking(true);
    bulkCheckProgress.start();
    try {
      await fetch(`/api/projects/${project.id}/check-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordIds: Array.from(checkedKeywordIds) }),
      });
      bulkCheckProgress.finish();
      router.refresh();
    } finally {
      setTimeout(() => setBulkChecking(false), 300);
    }
  }

  return (
    <SyncStatusContext.Provider value={syncStatus}>
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col">
      {/* Global bar — mirrors Ahrefs' dark top-level nav strip. Never
          unmounts, so the sync pill keeps showing (and the underlying
          fetch keeps running) no matter which tab the user switches to. */}
      <div className="h-12 shrink-0 bg-[#14171C] flex items-center justify-between px-3 sm:px-4 sticky top-0 z-30 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={22} height={22} className="shrink-0 rounded" />
          <span className="text-white text-sm font-medium tracking-tight truncate hidden sm:inline">
            Shopify Audit
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {activeSyncLabels.length > 0 && (
            <span
              title={`${activeSyncLabels.join(", ")} — puedes seguir navegando, esto sigue corriendo en segundo plano`}
              className="flex items-center gap-2 text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-md px-2.5 py-1 min-w-0"
            >
              <span className="w-3 h-3 shrink-0 rounded-full border-2 border-slate-500 border-t-white animate-spin" />
              <span className="truncate max-w-[140px] sm:max-w-[280px]">
                {activeSyncLabels.length === 1
                  ? activeSyncLabels[0]
                  : `Sincronizando ${activeSyncLabels.length}: ${activeSyncLabels.join(", ")}`}
              </span>
              <span className="hidden md:inline text-slate-500 shrink-0">· puedes seguir navegando</span>
            </span>
          )}
          {readOnly ? (
            <span className="text-[11px] uppercase tracking-wide bg-white/10 text-slate-300 rounded-md px-2.5 py-1 shrink-0">
              Vista de solo lectura
            </span>
          ) : (
            <a
              href="/api/logout"
              className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 rounded-md px-3 py-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              Cerrar sesión
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 md:flex">
        <aside className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-neutral-200 md:min-h-[calc(100vh-3rem)] md:sticky md:top-12 px-2 py-2 md:py-3">
          <nav className="flex md:flex-col gap-1.5 md:gap-0 shrink-0">
            {NAV_GROUPS.filter(
              (group) =>
                !readOnly ||
                (group.id !== "conexiones" && group.id !== "configuracion")
            ).map((group, gi) => (
              <div key={group.id ?? `group-${gi}`} className="flex md:flex-col gap-0.5 md:mb-0.5">
                {group.id === null ? (
                  <p className="px-2.5 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    {group.label}
                  </p>
                ) : (
                  <NavButton
                    item={NAV_ITEMS.find((i) => i.id === group.id)!}
                    active={activeTab === group.id}
                    onClick={() => setActiveTab(group.id as NavId)}
                  />
                )}
                {group.children?.map((childId) => (
                  <NavButton
                    key={childId}
                    item={NAV_ITEMS.find((i) => i.id === childId)!}
                    active={activeTab === childId}
                    indent
                    onClick={() => setActiveTab(childId)}
                  />
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-12 z-20 bg-white border-b border-neutral-200 relative">
            <div className="px-4 sm:px-6 lg:px-10 py-2.5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5 min-w-0 text-sm">
                {!readOnly && (
                  <Link
                    href="/"
                    className="text-neutral-500 hover:text-neutral-800 transition-colors shrink-0"
                  >
                    Todos los proyectos
                  </Link>
                )}
                {!readOnly && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-300">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                )}
                {readOnly ? (
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{project.name}</p>
                  </div>
                ) : (
                  <ProjectSwitcher
                    currentId={project.id}
                    currentName={project.name}
                    currentDomain={project.domain}
                    variant="breadcrumb"
                  />
                )}
                <span className="text-neutral-300 hidden sm:inline">·</span>
                <span className="text-neutral-400 text-xs truncate hidden sm:inline">{project.domain}</span>
              </div>
            </div>
          </header>

          <fieldset disabled={readOnly} className="flex-1 min-w-0 border-0 m-0 p-0 px-4 sm:px-6 lg:px-8 py-5 max-w-8xl mx-auto w-full">
          {activeTab === "panel" && (
            <div className="flex flex-col gap-5">
              <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <OverviewPanel title="Rankings">
                  <OverviewStat label="Keywords rastreadas" value={String(stats.trackedKeywords)} />
                  <OverviewStat
                    label="Posicion prom."
                    value={stats.avgPosition != null ? stats.avgPosition.toFixed(1) : "—"}
                  />
                  <OverviewStat label="En Top 3" value={String(stats.top3)} valueClassName="text-[#155D34]" />
                  <OverviewStat label="En Top 10" value={String(stats.top10)} valueClassName="text-[#155D34]" />
                </OverviewPanel>

                <OverviewPanel title="Search Console (28d)">
                  {project.gscSiteUrl ? (
                    <>
                      <OverviewStat label="Clics" value={(project.gscClicks28d ?? 0).toLocaleString("es-MX")} />
                      <OverviewStat
                        label="Impresiones"
                        value={(project.gscImpressions28d ?? 0).toLocaleString("es-MX")}
                      />
                      <OverviewStat
                        label="CTR"
                        value={
                          project.gscImpressions28d
                            ? `${(((project.gscClicks28d ?? 0) / project.gscImpressions28d) * 100).toFixed(1)}%`
                            : "—"
                        }
                      />
                      <OverviewStat
                        label="Posicion prom."
                        value={project.gscAvgPosition28d != null ? project.gscAvgPosition28d.toFixed(1) : "—"}
                      />
                    </>
                  ) : (
                    <p className="text-xs text-neutral-400 col-span-2">
                      Conecta Search Console en Conexiones para ver clics e impresiones reales.
                    </p>
                  )}
                </OverviewPanel>

                <OverviewPanel title="Dominio (estimado)">
                  {project.domainTrafficCheckedAt ? (
                    <>
                      <OverviewStat
                        label="Keywords organicas"
                        value={(project.domainOrganicKeywords ?? 0).toLocaleString("es-MX")}
                      />
                      <OverviewStat
                        label="Trafico organico"
                        value={(project.domainOrganicTrafficEstimate ?? 0).toLocaleString("es-MX")}
                      />
                      <OverviewStat
                        label="Valor est."
                        value={`$${(project.domainTrafficValueEstimate ?? 0).toLocaleString("es-MX")}`}
                      />
                    </>
                  ) : (
                    <p className="text-xs text-neutral-400 col-span-2">
                      Ve a Competencia y usa &ldquo;Analizar mi dominio&rdquo; para ver el trafico organico estimado.
                    </p>
                  )}
                </OverviewPanel>
              </section>

              {project.gscSiteUrl && <OrganicTrafficChart projectId={project.id} />}

              <section>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Resumen general
                </h2>
                <PanelSummaryGrid project={project} onNavigate={setActiveTab} />
              </section>

              <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <BestWorstKeywordsCard
                  title="Mejor posicionadas"
                  keywords={project.keywords}
                  ownDomain={project.domain}
                  order="best"
                  limit={10}
                />
                <BestWorstKeywordsCard
                  title="Necesitan atencion"
                  keywords={project.keywords}
                  ownDomain={project.domain}
                  order="worst"
                  limit={5}
                />
                <BestWorstKeywordsCard
                  title="Mayor cambio"
                  keywords={project.keywords}
                  ownDomain={project.domain}
                  order="change"
                  limit={5}
                />
              </section>

              <section>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Tecnologias detectadas
                </h2>
                <TechDetectSection project={project} />
              </section>
            </div>
          )}

          {activeTab === "analiticas" && (
            <section>
              <AnalyticsSection project={project} />
            </section>
          )}

          {activeTab === "conexiones" && (
            <section className="flex flex-col gap-5">
              <div>
                <ConnectBanner connected={gscConnected} error={gscError} label="Search Console" />
                <ConnectBanner connected={gaConnected} error={gaError} label="Google Analytics" />
              </div>
              <GscSection project={project} />
              <GaSection project={project} />
              <ComingSoonSection
                title="Conectar Shopify"
                description="Estamos esperando que Shopify apruebe el acceso a datos protegidos de clientes para poder leer tus ventas reales via Admin API. En cuanto se apruebe, se activa aqui mismo."
              />
            </section>
          )}

          {activeTab === "configuracion" && (
            <section className="flex flex-col gap-5">
              <div>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Ubicacion e idioma
                </h2>
                <LocationSection project={project} />
              </div>
              <div>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Proyecto
                </h2>
                <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-sm text-neutral-600">
                  <p><span className="text-neutral-400">Nombre:</span> {project.name}</p>
                  <p className="mt-1"><span className="text-neutral-400">Dominio:</span> {project.domain}</p>
                  <p className="mt-1"><span className="text-neutral-400">Creado:</span> {new Date(project.createdAt).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
              </div>
              <div>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Compartir con el cliente
                </h2>
                <ShareLinkSection project={project} />
              </div>
            </section>
          )}

          {activeTab === "planificacion" && (
            <section>
              <PlanningSection project={project} />
            </section>
          )}

          {activeTab === "seo-ia" && (
            <section>
              <AiVisibilitySection project={project} />
            </section>
          )}

          {activeTab === "rankings" && (
            <div className="flex flex-col gap-5">
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Keywords" value={String(stats.trackedKeywords)} />
                <StatCard
                  label="Posicion prom."
                  value={stats.avgPosition != null ? stats.avgPosition.toFixed(1) : "—"}
                />
                <StatCard label="En Top 3" value={String(stats.top3)} />
                <StatCard label="En Top 10" value={String(stats.top10)} />
              </section>

              <section>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Agregar keyword
                </h2>
                <AddKeywordForm projectId={project.id} />
              </section>

              {project.keywords.length === 0 ? (
                <p className="text-neutral-400 text-sm">
                  Aun no hay keywords en este proyecto.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {selectedKeyword && (
                    <KeywordDetailCard
                      keyword={selectedKeyword}
                      ownDomain={project.domain}
                      competitorDomains={project.competitors.map((c) => c.domain)}
                    />
                  )}

                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                        Todas las keywords
                      </h2>
                      {checkedKeywordIds.size > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleBulkCheck}
                            disabled={bulkChecking}
                            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-2.5 py-1 transition-colors"
                          >
                            {bulkChecking
                              ? "Rastreando..."
                              : `Rastrear ${checkedKeywordIds.size} seleccionada${checkedKeywordIds.size > 1 ? "s" : ""}`}
                          </button>
                          <ConfirmButton
                            onConfirm={handleBulkDelete}
                            label={
                              bulkDeleting
                                ? "Eliminando..."
                                : `Eliminar ${checkedKeywordIds.size} seleccionada${checkedKeywordIds.size > 1 ? "s" : ""}`
                            }
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-2.5 py-1 transition-colors"
                          />
                        </div>
                      )}
                    </div>
                    {bulkChecking && (
                      <div className="pb-2">
                        <ProgressBar percent={bulkCheckProgress.percent} />
                      </div>
                    )}
                    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[14px] text-neutral-400 border-b border-neutral-200">
                              <th className="pl-3 pr-2 py-2 text-left w-8">
                                <input
                                  type="checkbox"
                                  checked={
                                    sortedKeywords.length > 0 &&
                                    checkedKeywordIds.size === sortedKeywords.length
                                  }
                                  onChange={toggleCheckAll}
                                  className="w-4 h-4 accent-[#228449] cursor-pointer"
                                />
                              </th>
                              <th className="px-2 py-2 text-left font-normal">
                                <SortHeader
                                  label="Keyword"
                                  active={keywordSortBy === "keyword"}
                                  dir={keywordSortDir}
                                  onClick={() => toggleKeywordSort("keyword")}
                                />
                              </th>
                              <th className="px-2 py-2 text-right font-normal">
                                <span className="inline-flex justify-end w-full">
                                  <SortHeader
                                    label="Posicion"
                                    active={keywordSortBy === "position"}
                                    dir={keywordSortDir}
                                    onClick={() => toggleKeywordSort("position")}
                                  />
                                </span>
                              </th>
                              <th className="px-2 py-2 text-right font-normal">
                                <span className="inline-flex justify-end w-full">
                                  <SortHeader
                                    label="Cambio"
                                    active={keywordSortBy === "change"}
                                    dir={keywordSortDir}
                                    onClick={() => toggleKeywordSort("change")}
                                  />
                                </span>
                              </th>
                              <th className="px-2 py-2 text-right font-normal hidden sm:table-cell">
                                <span className="inline-flex justify-end w-full">
                                  <SortHeader
                                    label="Mejor"
                                    active={keywordSortBy === "best"}
                                    dir={keywordSortDir}
                                    onClick={() => toggleKeywordSort("best")}
                                  />
                                </span>
                              </th>
                              <th className="px-2 py-2 text-left font-normal hidden md:table-cell">URL</th>
                              <th className="px-2 py-2 text-right font-normal hidden sm:table-cell">
                                <span className="inline-flex justify-end w-full">
                                  <SortHeader
                                    label="Actualizado"
                                    active={keywordSortBy === "date"}
                                    dir={keywordSortDir}
                                    onClick={() => toggleKeywordSort("date")}
                                  />
                                </span>
                              </th>
                              <th className="px-2 py-2 w-20" />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedKeywords.map((keyword) => (
                              <KeywordListItem
                                key={keyword.id}
                                keyword={keyword}
                                ownDomain={project.domain}
                                competitorDomains={project.competitors.map((c) => c.domain)}
                                selected={keyword.id === selectedKeywordId}
                                onSelect={() => setSelectedKeywordId(keyword.id)}
                                checked={checkedKeywordIds.has(keyword.id)}
                                onToggleChecked={() => toggleChecked(keyword.id)}
                                onDeleted={() => {
                                  if (selectedKeywordId === keyword.id) {
                                    setSelectedKeywordId(null);
                                  }
                                }}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}

          {activeTab === "competencia" && (
            <section>
              <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                Competidores
              </h2>
              <CompetitorsSection project={project} />
            </section>
          )}

          {activeTab === "velocidad" && (
            <section>
              <PageSpeedSection project={project} />
            </section>
          )}

          {activeTab === "monitoreo" && (
            <section>
              <ShopifyStatusSection />
            </section>
          )}

          {activeTab === "youtube" && (
            <section>
              <YoutubeSection project={project} />
            </section>
          )}

          {activeTab === "auditoria" && (
            <section className="flex flex-col gap-5">
              <div>
                <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  Catalogo (Shopify)
                </h2>
                <EcommerceSection project={project} />
              </div>
              <BrokenLinksSection project={project} />
              <AuditSection project={project} />
            </section>
          )}

          {activeTab === "changelog" && (
            <section>
              <ChangelogSection />
            </section>
          )}

          {activeTab === "contenidos" && (
            <section>
              <ContentStrategySection project={project} />
            </section>
          )}

          {activeTab === "apps" && (
            <section>
              <ComingSoonSection
                title="Apps iOS y Android"
                description="Busca tu app (o la de tus competidores) en Google Play y la App Store: calificacion, numero de reseñas y precio. Lo estamos afinando antes de activarlo."
              />
            </section>
          )}

          {activeTab === "marketplaces" && (
            <section>
              <ComingSoonSection
                title="Marketplaces"
                description="Analiza tus productos en Mercado Libre y Amazon: precios, calificaciones, posicion en busquedas del marketplace y mas. Muy pronto."
              />
            </section>
          )}

          {activeTab === "notificaciones" && (
            <section>
              <ComingSoonSection
                title="Notificaciones"
                description="Recibe un WhatsApp con un resumen de tus cambios de posiciones — por ejemplo, las 10 keywords que mas subieron esta semana. Muy pronto."
              />
            </section>
          )}
        </fieldset>
        </div>
      </div>
    </div>
    </SyncStatusContext.Provider>
  );
}


interface DetectedTechRow {
  name: string;
  category: string;
  icon: string;
  url: string;
}

// Real brand favicon (via Google's public favicon service — no API key,
// works for essentially any domain) instead of an emoji approximation.
// Falls back to the emoji if the image fails to load.
function TechLogo({ url, icon, size = 20 }: { url: string; icon: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  let domain: string | null = null;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = null;
  }

  if (failed || !domain) {
    return <span style={{ fontSize: size * 0.6 }}>{icon}</span>;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=${size * 2}&domain=${domain}`}
      alt=""
      width={size}
      height={size}
      className="rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

function TechDetectSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const sync = useSyncStatus();
  const autoRunTriggered = useRef(false);

  const hasResult = project.techCheckedAt != null;
  const detected: DetectedTechRow[] = project.techDetectedJson
    ? JSON.parse(project.techDetectedJson)
    : [];

  const byCategory = detected.reduce<Record<string, DetectedTechRow[]>>((acc, t) => {
    acc[t.category] = acc[t.category] ?? [];
    acc[t.category].push(t);
    return acc;
  }, {});

  async function handleRun() {
    setLoading(true);
    setError(null);
    startProgress();
    sync.begin("tech", "Detectando tecnologias");
    try {
      const res = await fetch(`/api/projects/${project.id}/tech/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setTimeout(() => setLoading(false), 300);
      sync.end("tech");
    }
  }

  useEffect(() => {
    if (!hasResult && !loading && !autoRunTriggered.current) {
      autoRunTriggered.current = true;
      handleRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResult]);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-neutral-500 text-xs">
          Detecta la plataforma, herramientas de analitica, apps de reseñas,
          email marketing y mas, leyendo el HTML publico de {project.domain}.
        </p>
        <button
          onClick={handleRun}
          disabled={loading}
          className="text-sm bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          {loading ? "Analizando..." : hasResult ? "Volver a analizar" : "Detectar tecnologias"}
        </button>
      </div>

      {loading && (
        <div className="mt-3">
          <ProgressBar percent={progress} />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {hasResult && detected.length === 0 && (
        <p className="text-xs text-neutral-400 mt-3">
          No reconocimos ninguna tecnologia conocida en el HTML publico.
        </p>
      )}

      {hasResult && detected.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs text-neutral-500 mb-2">{category}</p>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 group"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-neutral-200 text-xs shrink-0 overflow-hidden">
                      <TechLogo url={item.url} icon={item.icon} size={16} />
                    </span>
                    <span className="text-sm text-neutral-700 group-hover:text-[#228449] group-hover:underline transition-colors">
                      {item.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface KeywordSuggestionRow {
  keyword: string;
  searchVolume: number | null;
  competition: number | null;
  cpc: number | null;
}

function HeaderTip({
  label,
  tip,
  align = "left",
}: {
  label: React.ReactNode;
  tip: string;
  align?: "left" | "right";
}) {
  return (
    <span className="relative inline-flex items-center gap-1 group cursor-help">
      {label}
      <span className="text-neutral-300">ⓘ</span>
      <span
        className={`pointer-events-none absolute ${
          align === "right" ? "right-0" : "left-0"
        } top-full mt-1.5 hidden group-hover:block w-max max-w-[220px] whitespace-normal bg-neutral-900 text-white text-[14px] leading-snug rounded-lg px-2.5 py-1.5 z-30 shadow-lg text-left font-normal normal-case`}
      >
        {tip}
      </span>
    </span>
  );
}

type PlanningSortColumn = "keyword" | "volume" | "competition" | "cpc";

function PlanningSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<KeywordSuggestionRow[]>([]);
  const [addingKeyword, setAddingKeyword] = useState<string | null>(null);
  const [addingBulk, setAddingBulk] = useState(false);
  const [checkedSuggestions, setCheckedSuggestions] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<PlanningSortColumn>("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const trackedTexts = new Set(project.keywords.map((k) => k.text.toLowerCase()));

  function toggleSort(column: PlanningSortColumn) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "keyword" ? "asc" : "desc");
    }
  }

  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "keyword") return a.keyword.localeCompare(b.keyword) * dir;
    const key = sortBy === "volume" ? "searchVolume" : sortBy === "competition" ? "competition" : "cpc";
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * dir;
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/planning/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedKeyword: seed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar sugerencias");
      setSuggestions(data.suggestions ?? []);
      setCheckedSuggestions(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar sugerencias");
    } finally {
      setLoading(false);
    }
  }

  async function addKeywordRequest(keyword: string) {
    await fetch(`/api/projects/${project.id}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: keyword,
        engine: "google",
        device: "desktop",
        source: "planning",
      }),
    });
  }

  async function handleAdd(keyword: string) {
    setAddingKeyword(keyword);
    try {
      await addKeywordRequest(keyword);
      router.refresh();
    } finally {
      setAddingKeyword(null);
    }
  }

  function toggleSuggestionChecked(keyword: string) {
    setCheckedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  const selectableSuggestions = sortedSuggestions.filter(
    (s) => !trackedTexts.has(s.keyword.toLowerCase())
  );

  function toggleCheckAllSuggestions() {
    setCheckedSuggestions((prev) =>
      prev.size === selectableSuggestions.length
        ? new Set()
        : new Set(selectableSuggestions.map((s) => s.keyword))
    );
  }

  async function handleAddBulk() {
    setAddingBulk(true);
    try {
      await Promise.all(Array.from(checkedSuggestions).map((k) => addKeywordRequest(k)));
      setCheckedSuggestions(new Set());
      router.refresh();
    } finally {
      setAddingBulk(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <p className="text-sm font-medium text-neutral-900">Planificacion de keywords</p>
        <p className="text-neutral-500 text-xs mt-0.5 mb-3">
          Escribe una palabra clave y te damos ideas relacionadas con
          volumen de busqueda real, para que elijas cuales vale la pena
          rastrear.
        </p>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-[14px] text-neutral-500">Palabra clave semilla</label>
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="mobiliario para hoteles"
              className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !seed}
            className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
          >
            {loading ? "Buscando..." : "Buscar ideas"}
          </button>
        </form>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {checkedSuggestions.size > 0 && (
            <div className="flex items-center justify-between bg-neutral-100 border border-[#228449]/20 rounded-xl px-3 py-2">
              <p className="text-xs text-neutral-600">
                {checkedSuggestions.size} keyword{checkedSuggestions.size > 1 ? "s" : ""} seleccionada{checkedSuggestions.size > 1 ? "s" : ""}
              </p>
              <button
                onClick={handleAddBulk}
                disabled={addingBulk}
                className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors"
              >
                {addingBulk ? "Agregando..." : `+ Rastrear ${checkedSuggestions.size} seleccionada${checkedSuggestions.size > 1 ? "s" : ""}`}
              </button>
            </div>
          )}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selectableSuggestions.length > 0 &&
                      checkedSuggestions.size === selectableSuggestions.length
                    }
                    onChange={toggleCheckAllSuggestions}
                    className="w-4 h-4 accent-[#228449] cursor-pointer"
                  />
                </th>
                <th className="text-left font-medium text-neutral-500 text-xs px-3 py-2">
                  <SortHeader label="Keyword" active={sortBy === "keyword"} dir={sortDir} onClick={() => toggleSort("keyword")} />
                </th>
                <th className="text-right font-medium text-neutral-500 text-xs px-3 py-2">
                  <span className="inline-flex justify-end">
                    <HeaderTip
                      label={<SortHeader label="Volumen/mes" active={sortBy === "volume"} dir={sortDir} onClick={() => toggleSort("volume")} />}
                      tip="Cuantas veces al mes se busca esta palabra en Google, en promedio."
                      align="right"
                    />
                  </span>
                </th>
                <th className="text-right font-medium text-neutral-500 text-xs px-3 py-2">
                  <span className="inline-flex justify-end">
                    <HeaderTip
                      label={<SortHeader label="Competencia" active={sortBy === "competition"} dir={sortDir} onClick={() => toggleSort("competition")} />}
                      tip="Que tan disputada esta la keyword entre anunciantes de pago. Mas alto = mas dificil de posicionar organicamente tambien."
                      align="right"
                    />
                  </span>
                </th>
                <th className="text-right font-medium text-neutral-500 text-xs px-3 py-2">
                  <span className="inline-flex justify-end">
                    <HeaderTip
                      label={<SortHeader label="CPC" active={sortBy === "cpc"} dir={sortDir} onClick={() => toggleSort("cpc")} />}
                      tip="Costo por clic: lo que pagaria un anunciante por cada clic en Google Ads con esta keyword. Sirve como señal de que tan 'valiosa' es comercialmente."
                      align="right"
                    />
                  </span>
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedSuggestions.map((s) => {
                const already = trackedTexts.has(s.keyword.toLowerCase());
                return (
                  <tr key={s.keyword} className="border-t border-neutral-200">
                    <td className="px-3 py-2">
                      {!already && (
                        <input
                          type="checkbox"
                          checked={checkedSuggestions.has(s.keyword)}
                          onChange={() => toggleSuggestionChecked(s.keyword)}
                          className="w-4 h-4 accent-[#228449] cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-800">{s.keyword}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">
                      {s.searchVolume?.toLocaleString("es-MX") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-600">
                      {s.competition != null ? `${Math.round(s.competition * 100)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-600">
                      {s.cpc != null ? `$${s.cpc.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {already ? (
                        <span className="text-[14px] text-neutral-400">Ya rastreada</span>
                      ) : (
                        <button
                          onClick={() => handleAdd(s.keyword)}
                          disabled={addingKeyword === s.keyword}
                          className="text-xs bg-white border border-neutral-200 hover:border-[#228449] disabled:opacity-50 text-neutral-700 rounded-md px-2.5 py-1 transition-colors"
                        >
                          {addingKeyword === s.keyword ? "Agregando..." : "+ Rastrear"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AiKeywordRow({
  keyword,
  ownDomain,
  competitorDomains,
  latest,
  mentionCount,
  checksWithData,
  checked,
  onToggleChecked,
}: {
  keyword: KeywordDTO;
  ownDomain: string;
  competitorDomains: string[];
  latest: KeywordDTO["rankings"][number] | null;
  mentionCount: number;
  checksWithData: number;
  checked: boolean;
  onToggleChecked: () => void;
}) {
  const citedDomains: string[] = latest?.aiCitedDomainsJson
    ? JSON.parse(latest.aiCitedDomainsJson)
    : [];
  const competitorSet = new Set(competitorDomains);

  return (
    <div className="px-3 py-2.5 rounded-lg bg-white">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleChecked}
            className="shrink-0 w-4 h-4 accent-[#228449] cursor-pointer"
          />
          <div className="min-w-0">
            <p className="text-sm text-neutral-900 truncate">{keyword.text}</p>
            <p className="text-[14px] text-neutral-400">
              {checksWithData > 0 ? `${mentionCount} mencion${mentionCount === 1 ? "" : "es"} de ${checksWithData} rastreos` : "Sin datos todavia"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {checksWithData > 0 && (
            <span
              className={`text-[14px] rounded-md px-2 py-0.5 ${
                latest?.aiMentioned
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {latest?.aiMentioned ? "Mencionado" : "No mencionado"}
            </span>
          )}
        </div>
      </div>
      {latest?.aiOverviewText && (
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed border-t border-neutral-100 pt-2">
          &ldquo;{latest.aiOverviewText}&rdquo;
        </p>
      )}
      {citedDomains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {citedDomains.map((d) => (
            <span
              key={d}
              className={`text-[13px] rounded-md px-2 py-0.5 ${
                d === ownDomain
                  ? "bg-emerald-50 text-emerald-700"
                  : competitorSet.has(d)
                  ? "bg-amber-50 text-amber-700"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type AiSortColumn = "keyword" | "mentions" | "status";

// Real, automatic evidence of AI visibility: visits Google Analytics
// attributes to an AI assistant (ChatGPT, Perplexity, Gemini, Claude,
// Copilot, Grok, you.com, Meta AI...) by referrer domain, or to a UTM tag
// mentioning one of those. Unlike Google's AI Overview detection (Google
// only, needs a rastreo) or manual logging (removed, unreliable), this
// works for every AI engine automatically — as long as GA4 is connected.
function AiTrafficFromAnalytics({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const sync = useSyncStatus();

  const connected = Boolean(project.gaConnectedAt);
  const hasData = project.gaAnalyticsUpdatedAt != null;

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    startProgress();
    sync.begin("ga", "Actualizando Google Analytics");
    try {
      const res = await fetch(`/api/projects/${project.id}/ga/refresh-stats`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setTimeout(() => setRefreshing(false), 300);
      sync.end("ga");
    }
  }

  if (!connected) {
    return (
      <p className="text-xs text-neutral-400 bg-white border border-neutral-200 rounded-xl px-4 py-3">
        Conecta Google Analytics en Conexiones para ver, de forma
        automatica, cuantas visitas te mandan ChatGPT, Perplexity,
        Gemini, Claude, Copilot y otros agentes de IA (por dominio de
        referencia o por etiquetas UTM).
      </p>
    );
  }

  const bySource: { label: string; sessions: number }[] = project.gaAiTrafficBySourceJson
    ? JSON.parse(project.gaAiTrafficBySourceJson)
    : [];
  const landingPages: { path: string; sessions: number }[] = project.gaAiLandingPagesJson
    ? JSON.parse(project.gaAiLandingPagesJson)
    : [];
  const totalSessions = project.gaAiTrafficSessions28d ?? 0;

  return (
    <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            Trafico real desde IA (Google Analytics, ultimos 28 dias)
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Visitas reales que llegaron desde ChatGPT, Perplexity, Gemini,
            Claude, Copilot u otros agentes — detectadas por dominio de
            referencia o por UTM. Esto confirma que de verdad te estan
            enviando gente, no solo que te mencionan.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs bg-white border border-purple-200 hover:border-purple-300 disabled:opacity-50 text-purple-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {refreshing && (
        <div className="mt-3">
          <ProgressBar percent={progress} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {!hasData ? (
        <p className="text-xs text-neutral-400 mt-3">
          Dale a &quot;Actualizar&quot; para traer el trafico real que te
          mandan los agentes de IA.
        </p>
      ) : (
      <div className="mt-3">
        <StatCard label="Sesiones desde IA" value={totalSessions.toLocaleString("es-MX")} />
      </div>
      )}
      {hasData && (
      <>
      {totalSessions === 0 ? (
        <p className="text-xs text-neutral-400 mt-3">
          Sin visitas detectadas desde IA en este periodo todavia.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <p className="text-[14px] text-purple-700 uppercase tracking-wide mb-1.5">Por agente</p>
            <div className="flex flex-col gap-1">
              {bySource.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                  <span className="text-neutral-700 truncate">{s.label}</span>
                  <span className="text-neutral-400 shrink-0">{s.sessions.toLocaleString("es-MX")}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[14px] text-purple-700 uppercase tracking-wide mb-1.5">Paginas de aterrizaje</p>
            <div className="flex flex-col gap-1">
              {landingPages.map((p) => (
                <a
                  key={p.path}
                  href={`https://${project.domain}${p.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs hover:bg-purple-100/60 transition-colors"
                >
                  <span className="text-neutral-700 hover:text-[#228449] hover:underline truncate">{p.path}</span>
                  <span className="text-neutral-400 shrink-0">{p.sessions.toLocaleString("es-MX")}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// No analytics tool (GA4 included) reveals the actual prompt someone typed
// into ChatGPT/Perplexity — those platforms don't share it. The closest
// available proxy: cross-reference the pages AI sends traffic to (GA4)
// against the real Google queries Search Console already tracks for those
// same pages. Framed honestly as "related queries", not "the AI prompt".
function AiQueryCrossRefSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gscConnected = Boolean(project.gscSiteUrl);
  const hasLandingPages = Boolean(
    project.gaAiLandingPagesJson && JSON.parse(project.gaAiLandingPagesJson).length > 0
  );

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/seo-ia/query-crossref`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cruzar datos");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cruzar datos");
    } finally {
      setLoading(false);
    }
  }

  if (!gscConnected) {
    return (
      <p className="text-xs text-neutral-400 bg-white border border-neutral-200 rounded-xl px-4 py-3">
        Conecta Search Console en Conexiones para ver que consultas reales
        de Google se asocian a las paginas que la IA esta mandando visitar
        — no podemos saber la pregunta exacta que le hicieron a la IA,
        pero esto es la mejor pista disponible.
      </p>
    );
  }

  const crossRef: { path: string; queries: { query: string; impressions: number; clicks: number; position: number }[] }[] =
    project.aiQueryCrossRefJson ? JSON.parse(project.aiQueryCrossRefJson) : [];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-neutral-900">Posibles preguntas detras del trafico de IA</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Cruza las paginas donde aterriza el trafico de IA con las
            consultas reales que Google ya registra para esas mismas
            paginas en Search Console. No es la pregunta exacta que se le
            hizo a la IA (eso nadie lo comparte), pero es la mejor
            aproximacion disponible.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !hasLandingPages}
          className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {loading ? "Cruzando..." : "Cruzar con Search Console"}
        </button>
      </div>

      {!hasLandingPages && (
        <p className="text-xs text-neutral-400 mt-2">
          Primero actualiza el trafico de IA arriba para tener paginas de
          aterrizaje que cruzar.
        </p>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {crossRef.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {crossRef.map((r) => (
            <div key={r.path} className="bg-white border border-neutral-100 rounded-lg px-3 py-2.5">
              <a
                href={`https://${project.domain}${r.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-neutral-800 hover:text-[#228449] hover:underline"
              >
                {r.path}
              </a>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {r.queries.map((q) => (
                  <span
                    key={q.query}
                    title={`${q.impressions.toLocaleString("es-MX")} impresiones · posicion ${q.position.toFixed(1)}`}
                    className="text-[14px] bg-neutral-100 text-neutral-600 rounded-md px-2 py-0.5"
                  >
                    {q.query}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {project.aiQueryCrossRefUpdatedAt && crossRef.length === 0 && hasLandingPages && (
        <p className="text-xs text-neutral-400 mt-3">
          No encontramos consultas de Search Console para esas paginas
          especificas todavia.
        </p>
      )}
    </div>
  );
}

function AiVisibilitySection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<AiSortColumn>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function toggleSort(column: AiSortColumn) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "keyword" ? "asc" : "desc");
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(checkedIds).map((id) => fetch(`/api/keywords/${id}`, { method: "DELETE" }))
      );
      setCheckedIds(new Set());
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

  // Only Google is automatic (AI Overview, checked whenever you rastrea the
  // keyword in Rankings) — there's no reliable automatic way to check
  // ChatGPT/Perplexity mentions today, so this tool only reports Google.
  const aiRelevantKeywords = project.keywords.filter((k) => k.engine === "google");

  const rows = aiRelevantKeywords.map((keyword) => {
    const ownRankings = keyword.rankings
      .filter((r) => r.aiMentioned != null)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
    const latest = ownRankings[0] ?? null;
    const mentionCount = ownRankings.filter((r) => r.aiMentioned).length;
    return { keyword, latest, checksWithData: ownRankings.length, mentionCount };
  });

  const visibleRowsUnsorted = rows.filter((r) => r.checksWithData > 0);
  const mentionedNow = visibleRowsUnsorted.filter((r) => r.latest?.aiMentioned).length;

  const visibleRows = [...visibleRowsUnsorted].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "keyword") return a.keyword.text.localeCompare(b.keyword.text) * dir;
    if (sortBy === "mentions") return (a.mentionCount - b.mentionCount) * dir;
    // status: mentioned > not mentioned
    const score = (r: (typeof rows)[number]) => (r.latest?.aiMentioned ? 1 : 0);
    return (score(a) - score(b)) * dir;
  });

  const selectableIds = visibleRows.map((r) => r.keyword.id);
  function toggleCheckAll() {
    setCheckedIds((prev) =>
      prev.size === selectableIds.length ? new Set() : new Set(selectableIds)
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <p className="text-sm font-medium text-neutral-900">Visibilidad en IA</p>
        <p className="text-neutral-500 text-xs mt-0.5">
          Numero de veces que tu dominio aparece mencionado en el AI
          Overview de Google para tus keywords rastreadas (se revisa
          automaticamente cada vez que rastreas en Rankings).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <StatCard label="Menciones a tu dominio" value={String(mentionedNow)} />
          <StatCard label="Keywords con datos de IA" value={String(visibleRowsUnsorted.length)} />
          <StatCard
            label="Tasa de mencion"
            value={
              visibleRowsUnsorted.length > 0
                ? `${Math.round((mentionedNow / visibleRowsUnsorted.length) * 100)}%`
                : "—"
            }
          />
        </div>
      </div>

      <AiTrafficFromAnalytics project={project} />
      <AiQueryCrossRefSection project={project} />

      {visibleRows.length === 0 ? (
        <p className="text-xs text-neutral-400">
          Aun no hay datos de IA. Rastrea tus keywords de Google en
          Rankings — el AI Overview se revisa automaticamente en cada
          rastreo.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 px-3">
            <div className="flex items-center gap-2.5 text-[14px] text-neutral-400">
              <input
                type="checkbox"
                checked={selectableIds.length > 0 && checkedIds.size === selectableIds.length}
                onChange={toggleCheckAll}
                className="w-4 h-4 accent-[#228449] cursor-pointer"
              />
              <SortHeader label="Keyword" active={sortBy === "keyword"} dir={sortDir} onClick={() => toggleSort("keyword")} />
              <span className="text-neutral-200">·</span>
              <SortHeader label="Menciones" active={sortBy === "mentions"} dir={sortDir} onClick={() => toggleSort("mentions")} />
              <span className="text-neutral-200">·</span>
              <SortHeader label="Estado" active={sortBy === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
            </div>
            {checkedIds.size > 0 && (
              <ConfirmButton
                onConfirm={handleBulkDelete}
                label={
                  bulkDeleting
                    ? "Eliminando..."
                    : `Eliminar ${checkedIds.size} seleccionada${checkedIds.size > 1 ? "s" : ""}`
                }
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-2.5 py-1 transition-colors"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5 bg-white border border-neutral-200 rounded-xl p-1.5">
            {visibleRows.map(({ keyword, latest, mentionCount, checksWithData }) => (
              <AiKeywordRow
                key={keyword.id}
                keyword={keyword}
                ownDomain={project.domain}
                competitorDomains={project.competitors.map((c) => c.domain)}
                latest={latest}
                mentionCount={mentionCount}
                checksWithData={checksWithData}
                checked={checkedIds.has(keyword.id)}
                onToggleChecked={() => toggleChecked(keyword.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GscSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const connected = Boolean(project.gscSiteUrl);

  async function handleImport() {
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/gsc/import`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al importar");
      setMessage(
        `${data.keywords} keywords, ${data.rankingsImported} posiciones historicas importadas desde GSC.`
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  async function handleRefreshStats() {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/gsc/refresh-stats`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}/gsc/disconnect`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-3 bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3.5">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            Google Search Console
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Importa tus keywords y posiciones reales de {project.domain}.
          </p>
        </div>
        <a
          href={`/api/gsc/auth?projectId=${project.id}`}
          className="text-sm bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-900 font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          Conectar Google Search Console
        </a>
      </div>
    );
  }

  const hasStats = project.gscClicks28d != null;

  return (
    <div className="bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-neutral-700">
          Conectado a{" "}
          <span className="text-neutral-900 font-medium">
            {project.gscSiteUrl}
          </span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshStats}
            disabled={refreshing}
            className="text-xs bg-white border border-neutral-300 hover:border-neutral-400 disabled:opacity-50 text-neutral-900 font-medium rounded-md px-3 py-1.5"
          >
            {refreshing ? "Actualizando..." : "Actualizar metricas"}
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5"
          >
            {importing ? "Importando..." : "Importar desde GSC"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs text-neutral-400 hover:text-red-600 transition-colors"
          >
            Desconectar
          </button>
        </div>
      </div>

      {hasStats && (
        <div className="flex flex-wrap gap-4 text-xs text-neutral-600 border-t border-neutral-200 pt-2">
          <span>
            <strong className="text-neutral-900">
              {(project.gscClicks28d ?? 0).toLocaleString("es-MX")}
            </strong>{" "}
            clics (28d)
          </span>
          <span>
            <strong className="text-neutral-900">
              {(project.gscImpressions28d ?? 0).toLocaleString("es-MX")}
            </strong>{" "}
            impresiones (28d)
          </span>
          <span>
            Pos. prom. GSC{" "}
            <strong className="text-neutral-900">
              {project.gscAvgPosition28d?.toFixed(1) ?? "—"}
            </strong>
          </span>
        </div>
      )}

      {message && <p className="text-xs text-neutral-500">{message}</p>}
    </div>
  );
}

type MetricLevel = "good" | "ok" | "bad";

function levelStyles(level: MetricLevel) {
  if (level === "good") return { dot: "bg-emerald-500", text: "text-emerald-700" };
  if (level === "ok") return { dot: "bg-amber-500", text: "text-amber-700" };
  return { dot: "bg-red-500", text: "text-red-700" };
}

function overallVerdict(score: number | null) {
  if (score == null) return null;
  if (score >= 90)
    return {
      level: "good" as MetricLevel,
      headline: "Tu sitio tiene buen rendimiento",
      detail: "Carga rápido para la mayoría de tus visitantes.",
    };
  if (score >= 50)
    return {
      level: "ok" as MetricLevel,
      headline: "Tu sitio necesita mejoras",
      detail: "Funciona, pero algunos visitantes notan que es lento.",
    };
  return {
    level: "bad" as MetricLevel,
    headline: "Tu sitio tiene problemas de velocidad",
    detail: "Esto puede estar alejando visitantes y afectando tu posición en Google.",
  };
}

function lcpStatus(ms: number | null) {
  if (ms == null) return null;
  const seconds = ms / 1000;
  if (ms <= 2500)
    return { level: "good" as MetricLevel, text: "Tu contenido aparece rápido", advice: null };
  if (ms <= 4000)
    return {
      level: "ok" as MetricLevel,
      text: "Tu contenido tarda un poco en aparecer",
      advice: "Prueba comprimir imágenes grandes y usar un buen hosting.",
    };
  return {
    level: "bad" as MetricLevel,
    text: `Tu contenido tarda ${seconds.toFixed(1)}s en aparecer — es lento`,
    advice: "Comprime imágenes, activa caché y revisa la velocidad de tu hosting.",
  };
}

function clsStatus(value: number | null) {
  if (value == null) return null;
  if (value <= 0.1)
    return { level: "good" as MetricLevel, text: "La página no se mueve al cargar", advice: null };
  if (value <= 0.25)
    return {
      level: "ok" as MetricLevel,
      text: "La página se mueve un poco mientras carga",
      advice: "Dale un tamaño fijo a tus imágenes y banners.",
    };
  return {
    level: "bad" as MetricLevel,
    text: "La página salta mucho mientras carga",
    advice: "Dale un tamaño fijo a imágenes, videos y anuncios para que no empujen el contenido.",
  };
}

function inpStatus(ms: number | null) {
  if (ms == null) return null;
  if (ms <= 200)
    return { level: "good" as MetricLevel, text: "Responde rápido cuando alguien hace clic", advice: null };
  if (ms <= 500)
    return {
      level: "ok" as MetricLevel,
      text: "Responde con algo de retraso a los clics",
      advice: "Revisa si hay scripts pesados o plugins de más.",
    };
  return {
    level: "bad" as MetricLevel,
    text: "Tarda en reaccionar cuando alguien interactua",
    advice: "Reduce plugins y scripts de terceros que bloqueen el navegador.",
  };
}

function MetricRow({
  label,
  status,
}: {
  label: string;
  status: { level: MetricLevel; text: string; advice: string | null } | null;
}) {
  if (!status) return null;
  const styles = levelStyles(status.level);
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
      <div>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">{label}:</span> {status.text}
        </p>
        {status.advice && (
          <p className="text-xs text-neutral-500 mt-0.5">{status.advice}</p>
        )}
      </div>
    </div>
  );
}


// Small, non-invasive banner — a single line, not a modal or popup.
function ExpertBanner() {
  return (
    <a
      href={EXPERT_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 text-xs bg-white border border-dashed border-neutral-200 hover:border-[#228449]/40 rounded-lg px-3 py-2 text-neutral-500 hover:text-neutral-700 transition-colors"
    >
      <span>¿Prefieres que un experto te ayude a corregir esto?</span>
      <span className="text-[#228449] font-medium whitespace-nowrap">Quiero que me ayude un experto →</span>
    </a>
  );
}

function PageSpeedSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const [resolvedIssueIds, setResolvedIssueIds] = useState<Set<string>>(new Set());
  const sync = useSyncStatus();

  const hasResult = project.psiUpdatedAt != null;
  const verdict = overallVerdict(project.psiPerformanceScore);
  const issues: { id: string; title: string; description: string; displayValue: string | null; score: number | null }[] =
    project.psiIssuesJson ? JSON.parse(project.psiIssuesJson) : [];

  function toggleResolved(id: string) {
    setResolvedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    startProgress();
    sync.begin("pagespeed", "Analizando velocidad");
    try {
      const res = await fetch(`/api/projects/${project.id}/pagespeed/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setTimeout(() => setLoading(false), 300);
      sync.end("pagespeed");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            Velocidad de tu sitio
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Que tan bien carga {project.domain} en celulares.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="text-sm bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          {loading
            ? "Analizando..."
            : hasResult
            ? "Volver a analizar"
            : "Analizar velocidad"}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col gap-1.5">
          <ProgressBar percent={progress} />
          <p className="text-[14px] text-neutral-400">
            Analizando tu sitio con PageSpeed Insights, esto puede tardar
            unos segundos...
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hasResult && !loading && (
        <div className="flex flex-col gap-4">
          {verdict ? (
            <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-lg px-4 py-3">
              <div
                className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                  verdict.level === "good"
                    ? "bg-emerald-500"
                    : verdict.level === "ok"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              >
                {project.psiPerformanceScore}
              </div>
              <div>
                <p className={`text-sm font-semibold ${levelStyles(verdict.level).text}`}>
                  {verdict.headline}
                </p>
                <p className="text-xs text-neutral-500">{verdict.detail}</p>
                <p className="text-[14px] text-neutral-400 mt-0.5">
                  Calificacion de rendimiento: {project.psiPerformanceScore}/100
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 bg-white border border-neutral-200 rounded-lg px-4 py-3">
              No pudimos calcular una calificacion general, pero aqui esta lo
              que si pudimos medir:
            </p>
          )}

          <div className="flex flex-col gap-3">
            <MetricRow label="Velocidad de carga" status={lcpStatus(project.psiLcpMs)} />
            <MetricRow label="Estabilidad visual" status={clsStatus(project.psiCls)} />
            <MetricRow label="Capacidad de respuesta" status={inpStatus(project.psiInpMs)} />
            {!verdict &&
              project.psiLcpMs == null &&
              project.psiCls == null &&
              project.psiInpMs == null && (
                <p className="text-xs text-neutral-400">
                  Google no devolvio metricas para este sitio todavia.
                  Intenta analizar de nuevo en unos minutos.
                </p>
              )}
          </div>

          <p className="text-[14px] text-neutral-400">
            {project.psiFieldDataSource === "field"
              ? "Basado en datos reales de visitantes de tu sitio."
              : "Estimado con una prueba simulada (aun no hay suficientes visitas reales medidas)."}
          </p>

          {issues.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                Que corregir ({resolvedIssueIds.size}/{issues.length})
              </h3>
              <div className="flex flex-col gap-2">
                {issues.map((issue) => {
                  const resolved = resolvedIssueIds.has(issue.id);
                  return (
                    <label
                      key={issue.id}
                      className="flex items-start gap-2.5 bg-white border border-neutral-200 rounded-lg px-3 py-2.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={resolved}
                        onChange={() => toggleResolved(issue.id)}
                        className="mt-0.5 w-4 h-4 accent-[#228449] cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p
                            className={`text-sm font-medium ${
                              resolved ? "text-neutral-400 line-through" : "text-neutral-900"
                            }`}
                          >
                            {issue.title}
                          </p>
                          {issue.displayValue && (
                            <span className="text-[14px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 shrink-0">
                              {issue.displayValue}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${resolved ? "text-neutral-300" : "text-neutral-500"}`}>
                          {issue.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {hasResult && issues.length === 0 && (
            <p className="text-xs text-neutral-400">
              No encontramos problemas importantes que corregir — bien ahi.
            </p>
          )}

          <ExpertBanner />
        </div>
      )}
    </div>
  );
}

interface YoutubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  aiTitles?: string[];
  aiDescription?: string;
  aiSuggestedAt?: string;
}

type YoutubeSortColumn = "title" | "date" | "views" | "likes" | "comments";

function YoutubeVideoRow({
  video,
  projectId,
  isTop5,
}: {
  video: YoutubeVideo;
  projectId: string;
  isTop5: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();

  async function handleImprove() {
    setImproving(true);
    setError(null);
    startProgress();
    try {
      const res = await fetch(
        `/api/projects/${projectId}/youtube/videos/${video.videoId}/improve`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar sugerencias");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar sugerencias");
    } finally {
      setTimeout(() => setImproving(false), 300);
    }
  }

  return (
    <div className="rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-1.5 py-2 hover:bg-neutral-50 transition-colors">
        <a
          href={`https://www.youtube.com/watch?v=${video.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-16 shrink-0 relative"
        >
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt="" className="w-16 h-10 rounded object-cover" />
          )}
          {isTop5 && (
            <span className="absolute -top-1 -left-1 text-[13px] bg-[#228449] text-white rounded-full w-4 h-4 flex items-center justify-center">
              🔥
            </span>
          )}
        </a>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-neutral-800 truncate flex-1 text-left hover:text-[#228449] transition-colors"
        >
          {video.title}
        </button>
        <span className="text-xs text-neutral-400 w-16 text-right shrink-0">
          {new Date(video.publishedAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
        </span>
        <span className="text-xs text-neutral-600 w-16 text-right shrink-0">
          {video.viewCount.toLocaleString("es-MX")}
        </span>
        <span className="text-xs text-neutral-400 w-14 text-right shrink-0 hidden sm:inline">
          {video.likeCount.toLocaleString("es-MX")}
        </span>
        <span className="text-xs text-neutral-400 w-14 text-right shrink-0 hidden sm:inline">
          {video.commentCount.toLocaleString("es-MX")}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-neutral-400 hover:text-[#228449] hover:bg-neutral-100 transition-colors"
          title="Ver descripcion y sugerencias de IA"
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-3">
          <div>
            <p className="text-[13px] text-neutral-400 uppercase tracking-wide mb-1">Descripcion actual</p>
            <p className="text-xs text-neutral-600 whitespace-pre-line bg-white border border-neutral-100 rounded-lg px-3 py-2">
              {video.description || "Sin descripcion."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImprove}
              disabled={improving}
              className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors"
            >
              {improving ? "Generando..." : video.aiTitles?.length ? "Volver a generar con IA" : "Mejorar con IA"}
            </button>
            {video.aiSuggestedAt && !improving && (
              <span className="text-[13px] text-neutral-400">
                Generado {new Date(video.aiSuggestedAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          {improving && <ProgressBar percent={progress} />}
          {error && <p className="text-xs text-red-600">{error}</p>}

          {!improving && (video.aiTitles?.length || video.aiDescription) && (
            <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2.5 flex flex-col gap-2.5">
              {video.aiTitles && video.aiTitles.length > 0 && (
                <div>
                  <p className="text-[13px] text-neutral-900 uppercase tracking-wide mb-1">
                    Titulos sugeridos (con intencion viral)
                  </p>
                  <div className="flex flex-col gap-1">
                    {video.aiTitles.map((t, i) => (
                      <p key={i} className="text-xs text-neutral-700 bg-white rounded px-2 py-1.5">
                        {t}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {video.aiDescription && (
                <div>
                  <p className="text-[13px] text-neutral-900 uppercase tracking-wide mb-1">
                    Descripcion sugerida
                  </p>
                  <p className="text-xs text-neutral-700 bg-white rounded px-2 py-1.5 whitespace-pre-line">
                    {video.aiDescription}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function YoutubeSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<YoutubeSortColumn>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const connected = Boolean(project.youtubeChannelId);
  const videos: YoutubeVideo[] = project.youtubeRecentVideosJson
    ? (JSON.parse(project.youtubeRecentVideosJson) as Partial<YoutubeVideo>[]).map((v) => ({
        videoId: v.videoId ?? "",
        title: v.title ?? "",
        description: v.description ?? "",
        publishedAt: v.publishedAt ?? "",
        thumbnailUrl: v.thumbnailUrl ?? null,
        viewCount: v.viewCount ?? 0,
        likeCount: v.likeCount ?? 0,
        commentCount: v.commentCount ?? 0,
        aiTitles: v.aiTitles,
        aiDescription: v.aiDescription,
        aiSuggestedAt: v.aiSuggestedAt,
      }))
    : [];

  const top5ViewIds = new Set(
    [...videos]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5)
      .map((v) => v.videoId)
  );

  function toggleSort(column: YoutubeSortColumn) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "title" ? "asc" : "desc");
    }
  }

  const sortedVideos = [...videos].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title) * dir;
      case "views":
        return (a.viewCount - b.viewCount) * dir;
      case "likes":
        return (a.likeCount - b.likeCount) * dir;
      case "comments":
        return (a.commentCount - b.commentCount) * dir;
      default:
        return (
          (new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()) * dir
        );
    }
  });

  const channelAgeYears = project.youtubeChannelPublishedAt
    ? (
        (Date.now() - new Date(project.youtubeChannelPublishedAt).getTime()) /
        (1000 * 60 * 60 * 24 * 365)
      ).toFixed(1)
    : null;
  const avgViews =
    videos.length > 0
      ? Math.round(videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length)
      : null;
  const avgEngagement =
    videos.length > 0
      ? videos.reduce((sum, v) => {
          const rate = v.viewCount > 0 ? (v.likeCount + v.commentCount) / v.viewCount : 0;
          return sum + rate;
        }, 0) / videos.length
      : null;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al conectar");
      setInput("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar");
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}/youtube/disconnect`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <p className="text-sm font-medium text-neutral-900">SEO de YouTube</p>
        <p className="text-neutral-500 text-xs mt-0.5 mb-3">
          Conecta tu canal para ver suscriptores, vistas, engagement y tus
          videos recientes.
        </p>
        <form onSubmit={handleConnect} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-[14px] text-neutral-500">
              Canal (@handle, ID o URL)
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@acehrproyectos"
              className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={connecting || !input}
            className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
          >
            {connecting ? "Conectando..." : "Conectar canal"}
          </button>
        </form>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {project.youtubeThumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.youtubeThumbnailUrl}
                alt=""
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {project.youtubeChannelTitle}
              </p>
              <p className="text-[14px] text-neutral-400">
                {project.youtubeCountry ? `${project.youtubeCountry} · ` : ""}
                {channelAgeYears ? `${channelAgeYears} años en YouTube` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors"
            >
              {refreshing ? "Actualizando..." : "Actualizar"}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-neutral-400 hover:text-red-600 transition-colors"
            >
              Desconectar
            </button>
          </div>
        </div>

        {project.youtubeDescription && (
          <p className="text-xs text-neutral-500 mt-2 line-clamp-2">
            {project.youtubeDescription}
          </p>
        )}

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <StatCard label="Suscriptores" value={(project.youtubeSubscribers ?? 0).toLocaleString("es-MX")} />
          <StatCard label="Vistas totales" value={(project.youtubeViews ?? 0).toLocaleString("es-MX")} />
          <StatCard label="Videos" value={String(project.youtubeVideoCount ?? 0)} />
          <StatCard label="Vistas prom. (recientes)" value={avgViews != null ? avgViews.toLocaleString("es-MX") : "—"} />
          <StatCard
            label="Engagement prom."
            value={avgEngagement != null ? `${(avgEngagement * 100).toFixed(1)}%` : "—"}
          />
        </div>
      </div>

      {videos.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
            Videos recientes — los 5 mas vistos llevan insignia 🔥
          </h2>
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 text-[14px] text-neutral-400 border-b border-neutral-200">
              <span className="w-16 shrink-0" />
              <SortHeader label="Titulo" active={sortBy === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
              <span className="flex-1" />
              <span className="w-16 text-right"><SortHeader label="Fecha" active={sortBy === "date"} dir={sortDir} onClick={() => toggleSort("date")} /></span>
              <span className="w-16 text-right"><SortHeader label="Vistas" active={sortBy === "views"} dir={sortDir} onClick={() => toggleSort("views")} /></span>
              <span className="w-14 text-right hidden sm:inline"><SortHeader label="Likes" active={sortBy === "likes"} dir={sortDir} onClick={() => toggleSort("likes")} /></span>
              <span className="w-14 text-right hidden sm:inline"><SortHeader label="Coment." active={sortBy === "comments"} dir={sortDir} onClick={() => toggleSort("comments")} /></span>
            </div>
            <div className="flex flex-col p-1.5 gap-1">
              {sortedVideos.map((v) => (
                <YoutubeVideoRow
                  key={v.videoId}
                  video={v}
                  projectId={project.id}
                  isTop5={top5ViewIds.has(v.videoId)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChangelogEntryDTO {
  id: string;
  sourceUrl: string;
  title: string;
  titleEs: string;
  summaryEs: string;
  category: string;
  publishedAt: string;
}

interface ContentIdeaRow {
  title: string;
  keywords: string[];
  done?: boolean;
}

function ContentStrategySection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdeaRow[]>(() =>
    project.contentIdeasJson ? JSON.parse(project.contentIdeasJson) : []
  );

  useEffect(() => {
    setIdeas(project.contentIdeasJson ? JSON.parse(project.contentIdeasJson) : []);
  }, [project.contentIdeasJson]);

  const connected = Boolean(project.gscConnectedAt);

  async function handleToggle(index: number) {
    const nextDone = !ideas[index]?.done;
    setIdeas((prev) => prev.map((idea, i) => (i === index ? { ...idea, done: nextDone } : idea)));
    try {
      const res = await fetch(`/api/projects/${project.id}/content-strategy/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, done: nextDone }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIdeas((prev) => prev.map((idea, i) => (i === index ? { ...idea, done: !nextDone } : idea)));
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/content-strategy/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar ideas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar ideas");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyAll() {
    const text = ideas
      .map((idea) => `Titulo: ${idea.title}\nKeywords: ${idea.keywords.join(", ")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-3 bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3.5">
        <div>
          <p className="text-sm font-medium text-neutral-900">Contenidos</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Necesitas Search Console conectado para generar ideas basadas en
            busquedas reales — conectalo desde &ldquo;Conexiones&rdquo;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              Ideas de contenido para el blog
            </p>
            <p className="text-neutral-500 text-xs mt-0.5">
              12 titulos generados con IA a partir de las busquedas reales
              en Google de los ultimos 7 dias (Search Console), pensados
              para ayudarte a posicionar.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ideas.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="text-sm bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
              >
                {copied ? "Copiado ✓" : "Copiar todo"}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
            >
              {generating ? "Generando..." : ideas.length > 0 ? "Generar de nuevo" : "Generar ideas"}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        {project.contentIdeasUpdatedAt && (
          <p className="text-[14px] text-neutral-400 mt-3">
            Ultima vez: {new Date(project.contentIdeasUpdatedAt).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {ideas.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Aun no hay ideas generadas. Dale clic a &ldquo;Generar ideas&rdquo; arriba.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ideas.map((idea, i) => (
            <label
              key={i}
              className={`flex items-start gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                idea.done
                  ? "bg-neutral-50 border-neutral-100"
                  : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(idea.done)}
                onChange={() => handleToggle(i)}
                className="mt-1 w-4 h-4 accent-[#228449] shrink-0 cursor-pointer"
              />
              <div className="min-w-0">
                <p>
                  <span className="text-[13px] text-neutral-400 uppercase tracking-wide mr-1.5">
                    Titulo:
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      idea.done ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-900"
                    }`}
                  >
                    {idea.title}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[13px] text-neutral-400 uppercase tracking-wide">
                    Keywords:
                  </span>
                  {idea.keywords.map((k) => (
                    <span
                      key={k}
                      className="text-[13px] bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-600"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangelogSection() {
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

function AuditChecklistRow({
  item,
  checked,
  auto,
  onToggle,
}: {
  item: { id: string; label: string; hint: string };
  checked: boolean;
  auto: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        auto ? "cursor-default" : "cursor-pointer hover:bg-neutral-50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={auto}
        onChange={auto ? undefined : onToggle}
        className="mt-0.5 w-4 h-4 accent-[#228449] shrink-0 disabled:opacity-70"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm ${checked ? "text-neutral-500 line-through decoration-neutral-300" : "text-neutral-800"}`}>
            {item.label}
          </p>
          {auto && (
            <span className="text-[13px] uppercase tracking-wide bg-neutral-100 text-neutral-700 rounded-md px-2 py-0.5 shrink-0">
              Auto
            </span>
          )}
        </div>
        <p className="text-neutral-400 text-[14px] mt-0.5">{item.hint}</p>
      </div>
    </label>
  );
}

function BrokenLinksSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const sync = useSyncStatus();

  const hasResult = project.brokenLinksCheckedAt != null;
  const broken: { url: string; path: string; status: number }[] = project.brokenLinksJson
    ? JSON.parse(project.brokenLinksJson)
    : [];

  async function handleRun() {
    setLoading(true);
    setError(null);
    startProgress();
    sync.begin("broken-links", "Buscando enlaces rotos");
    try {
      const res = await fetch(`/api/projects/${project.id}/broken-links/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al revisar enlaces");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al revisar enlaces");
    } finally {
      setTimeout(() => setLoading(false), 300);
      sync.end("broken-links");
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Enlaces rotos (404)</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Rastrea el sitemap de {project.domain} ahora mismo y revisa el codigo de
            respuesta real de cada URL — Google Search Console no expone por API la
            lista de 404 que ve, asi que esto verifica el sitio directamente.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          {loading ? "Revisando..." : hasResult ? "Volver a revisar" : "Buscar enlaces rotos"}
        </button>
      </div>

      {loading && (
        <div className="mt-3">
          <ProgressBar percent={progress} />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {hasResult && !loading && (
        <div className="mt-4">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span
              className={`text-sm font-semibold rounded-md px-2.5 py-1 ${
                broken.length > 0 ? "bg-red-50 text-red-700" : "bg-[#E6F4EC] text-[#155D34]"
              }`}
            >
              {broken.length} {broken.length === 1 ? "enlace roto" : "enlaces rotos"}
            </span>
            <span className="text-xs text-neutral-400">
              {project.brokenLinksChecked ?? 0} URLs revisadas del sitemap
              {project.brokenLinksCheckedAt &&
                ` · ${new Date(project.brokenLinksCheckedAt).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
            </span>
          </div>

          {broken.length > 0 && (
            <div className="flex flex-col gap-1 bg-white border border-neutral-200 rounded-lg p-1.5">
              {broken.map((b) => (
                <div
                  key={b.url}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-red-600 shrink-0">{b.status}</span>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-neutral-700 hover:text-[#228449] hover:underline truncate"
                      title={b.url}
                    >
                      {b.path}
                    </a>
                  </div>
                  <a
                    href={`https://${project.domain}/admin/settings/redirects/new?path=${encodeURIComponent(b.path)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md px-2.5 py-1 transition-colors whitespace-nowrap shrink-0"
                  >
                    Crear redireccion →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>(() =>
    project.auditManualChecksJson ? JSON.parse(project.auditManualChecksJson) : {}
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const results = AUDIT_ITEMS.map((item) => ({
    item,
    auto: item.auto != null,
    checked: item.auto ? item.auto(project) : manualChecks[item.id] === true,
  }));

  const completedCount = results.filter((r) => r.checked).length;
  const totalCount = results.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  const categories = Array.from(new Set(AUDIT_ITEMS.map((i) => i.category)));

  async function handleToggle(itemId: string, nextChecked: boolean) {
    setManualChecks((prev) => ({ ...prev, [itemId]: nextChecked }));
    setSavingId(itemId);
    try {
      await fetch(`/api/projects/${project.id}/audit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, checked: nextChecked }),
      });
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              Auditoria de tienda ({totalCount} puntos)
            </p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Los marcados como <strong>Auto</strong> los detectamos solos con
              los datos de esta herramienta. El resto son recomendaciones que
              tu marcas conforme las vas cumpliendo.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-semibold text-neutral-900">
              {completedCount}/{totalCount}
            </p>
            <p className="text-[14px] text-neutral-400">{percent}% completo</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-neutral-200 rounded-md overflow-hidden">
          <div
            className="h-full bg-[#228449] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {categories.map((category) => {
        const rows = results.filter((r) => r.item.category === category);
        const catCompleted = rows.filter((r) => r.checked).length;
        return (
          <div key={category}>
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
              {category} ({catCompleted}/{rows.length})
            </h2>
            <div className="bg-white border border-neutral-200 rounded-xl p-1.5 flex flex-col gap-0.5">
              {rows.map(({ item, auto, checked }) => (
                <AuditChecklistRow
                  key={item.id}
                  item={item}
                  checked={checked}
                  auto={auto}
                  onToggle={() => handleToggle(item.id, !checked)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {savingId && (
        <p className="text-[14px] text-neutral-400">Guardando...</p>
      )}
    </div>
  );
}

function EcommerceSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const sync = useSyncStatus();

  const hasResult = project.ecommerceCheckedAt != null;
  const topSellingResult = parseTopSelling(project.ecommerceTopSellingJson);
  const topSelling = topSellingResult.items;

  async function handleRun() {
    setLoading(true);
    setError(null);
    startProgress();
    sync.begin("ecommerce", "Analizando catalogo");
    try {
      const res = await fetch(`/api/projects/${project.id}/ecommerce/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setTimeout(() => setLoading(false), 300);
      sync.end("ecommerce");
    }
  }

  const topVendors: { name: string; count: number }[] = project.ecommerceTopVendorsJson
    ? JSON.parse(project.ecommerceTopVendorsJson)
    : [];
  const topTypes: { name: string; count: number }[] = project.ecommerceTopTypesJson
    ? JSON.parse(project.ecommerceTopTypesJson)
    : [];
  const topTags: { name: string; count: number }[] = project.ecommerceTopTagsJson
    ? JSON.parse(project.ecommerceTopTagsJson)
    : [];

  const platformLabel =
    project.ecommercePlatform === "shopify"
      ? "Shopify"
      : project.ecommercePlatform === "woocommerce"
      ? "WooCommerce"
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              Auditoria de catalogo {platformLabel ? `(${platformLabel})` : ""}
            </p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Lee el catalogo publico de {project.domain} — funciona con
              Shopify o WooCommerce, sin API keys, sin volver a poner la URL.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={loading}
            className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
          >
            {loading ? "Analizando..." : hasResult ? "Volver a analizar" : "Analizar tienda"}
          </button>
        </div>

        {loading && (
          <div className="mt-3">
            <ProgressBar percent={progress} />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        {hasResult && !platformLabel && (
          <p className="text-xs text-neutral-400 mt-3">
            No detectamos un catalogo publico de Shopify ni WooCommerce en
            este dominio.
          </p>
        )}

        {hasResult && platformLabel && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            <StatCard
              label="Productos"
              value={`${project.ecommerceProductCount ?? 0}${project.ecommerceProductCountIsMin ? "+" : ""}`}
              hint={project.ecommerceProductCountIsMin ? "Shopify solo permite leer hasta 1000" : undefined}
            />
            <StatCard
              label="Colecciones/categorias"
              value={`${project.ecommerceCollectionCount ?? 0}${project.ecommerceCollectionCountIsMin ? "+" : ""}`}
              hint={project.ecommerceCollectionCountIsMin ? "Shopify solo permite leer hasta 250" : undefined}
            />
            {project.ecommerceTotalVariants != null && (
              <StatCard label="Variantes totales" value={String(project.ecommerceTotalVariants)} />
            )}
            <StatCard
              label="Rango de precios"
              value={
                project.ecommercePriceMin != null && project.ecommercePriceMax != null
                  ? `${formatMoney(project.ecommercePriceMin)} - ${formatMoney(project.ecommercePriceMax)}`
                  : "—"
              }
            />
            <StatCard
              label="Precio promedio"
              value={project.ecommerceAvgPrice != null ? formatMoney(project.ecommerceAvgPrice) : "—"}
            />
            {project.ecommerceNewestProductAt && (
              <StatCard
                label="Ultimo producto agregado"
                value={new Date(project.ecommerceNewestProductAt).toLocaleDateString("es-MX", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              />
            )}
          </div>
        )}
      </div>

      {hasResult && (topVendors.length > 0 || topTypes.length > 0 || topTags.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-3">
          {topVendors.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Marcas / vendedores</p>
              <div className="flex flex-col gap-1">
                {topVendors.map((v) => (
                  <a
                    key={v.name}
                    href={`https://${project.domain}/collections/all?filter.p.vendor=${encodeURIComponent(v.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-2 text-xs transition-colors"
                  >
                    <span className="text-neutral-700 group-hover:text-[#228449] truncate">{v.name}</span>
                    <span className="text-neutral-400 shrink-0">{v.count}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {topTypes.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Categorias / tipos</p>
              <div className="flex flex-col gap-1">
                {topTypes.map((v) => (
                  <a
                    key={v.name}
                    href={`https://${project.domain}/collections/all?filter.p.product_type=${encodeURIComponent(v.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-2 text-xs transition-colors"
                  >
                    <span className="text-neutral-700 group-hover:text-[#228449] truncate">{v.name}</span>
                    <span className="text-neutral-400 shrink-0">{v.count}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {topTags.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Tags mas usados</p>
              <div className="flex flex-wrap gap-1.5">
                {topTags.map((v) => (
                  <a
                    key={v.name}
                    href={`https://${project.domain}/collections/all?filter.p.tag=${encodeURIComponent(v.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] bg-white border border-neutral-200 hover:border-[#228449] hover:text-[#228449] rounded-md px-2 py-0.5 text-neutral-600 transition-colors"
                  >
                    {v.name} · {v.count}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasResult && topSelling.length > 0 && topSellingResult.source === "merchant" && (
        <div>
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
            {`Productos populares (coleccion "${topSellingResult.collectionTitle}")`}
          </h2>
          <div className="flex flex-col gap-1 bg-white border border-neutral-200 rounded-xl p-1.5">
            {topSelling.map((p, i) => (
              <a
                key={p.handle}
                href={`https://${project.domain}/products/${p.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <span className="text-neutral-400 text-xs shrink-0 w-4">{i + 1}.</span>
                <p className="text-sm text-neutral-800 truncate">{p.title}</p>
              </a>
            ))}
          </div>
          <p className="text-[14px] text-neutral-400 mt-1.5">
            {`Orden tal cual lo dejo la tienda en su propia coleccion "${topSellingResult.collectionTitle}" — el dato mas cercano a ventas reales sin acceso al Admin de Shopify.`}
          </p>
        </div>
      )}
    </div>
  );
}

interface GaProperty {
  propertyId: string;
  displayName: string;
  accountName: string;
}

type SalesBreakdownKey = "channel" | "source" | "medium" | "landingPage" | "device";

const SALES_BREAKDOWN_LABELS: Record<SalesBreakdownKey, { tab: string; column: string }> = {
  channel: { tab: "Canal", column: "Canal" },
  source: { tab: "Fuente", column: "Fuente" },
  medium: { tab: "Medio", column: "Medio" },
  landingPage: { tab: "Pagina (~keyword organica)", column: "Pagina de destino" },
  device: { tab: "Dispositivo", column: "Dispositivo" },
};

function AnalyticsSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesBreakdown, setSalesBreakdown] = useState<SalesBreakdownKey>("channel");
  const sync = useSyncStatus();

  const connected = Boolean(project.gaConnectedAt);
  const hasData = project.gaAnalyticsUpdatedAt != null;

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    sync.begin("ga", "Actualizando Google Analytics");
    try {
      const res = await fetch(`/api/projects/${project.id}/ga/refresh-stats`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setRefreshing(false);
      sync.end("ga");
    }
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-3 bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3.5">
        <div>
          <p className="text-sm font-medium text-neutral-900">Analiticas</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Conecta Google Analytics para ver ventas, paginas mas visitadas,
            paises y dispositivos de tus visitantes.
          </p>
        </div>
        <a
          href={`/api/ga/auth?projectId=${project.id}`}
          className="text-sm bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-900 font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          Conectar Google Analytics
        </a>
      </div>
    );
  }

  if (!project.gaPropertyId) {
    return (
      <p className="text-xs text-neutral-400">
        Termina de conectar tu propiedad de GA4 en el Panel para ver Analiticas.
      </p>
    );
  }

  const topPages: { path: string; views: number }[] = project.gaTopPagesJson
    ? JSON.parse(project.gaTopPagesJson)
    : [];
  const topCountries: { country: string; sessions: number }[] = project.gaTopCountriesJson
    ? JSON.parse(project.gaTopCountriesJson)
    : [];
  const device: { mobile: number; desktop: number; tablet: number } = project.gaDeviceBreakdownJson
    ? JSON.parse(project.gaDeviceBreakdownJson)
    : { mobile: 0, desktop: 0, tablet: 0 };
  const deviceTotal = device.mobile + device.desktop + device.tablet;
  const topCampaigns: { source: string; sessions: number }[] = project.gaTopCampaignsJson
    ? JSON.parse(project.gaTopCampaignsJson)
    : [];
  const topSources: { name: string; sessions: number }[] = project.gaTopSourcesJson
    ? JSON.parse(project.gaTopSourcesJson)
    : [];
  const topMediums: { name: string; sessions: number }[] = project.gaTopMediumsJson
    ? JSON.parse(project.gaTopMediumsJson)
    : [];
  type SalesBreakdownRow = { label: string; revenue: number; transactions: number; sessions: number };
  const parseSales = (json: string | null): SalesBreakdownRow[] => (json ? JSON.parse(json) : []);
  const salesBreakdowns: Record<SalesBreakdownKey, SalesBreakdownRow[]> = {
    channel: parseSales(project.gaSalesByChannelJson),
    source: parseSales(project.gaSalesBySourceJson),
    medium: parseSales(project.gaSalesByMediumJson),
    landingPage: parseSales(project.gaSalesByLandingPageJson),
    device: parseSales(project.gaSalesByDeviceJson),
  };
  const ordersByDate: { date: string; transactions: number; revenue: number }[] =
    project.gaOrdersByDateJson ? JSON.parse(project.gaOrdersByDateJson) : [];
  const topProducts: { name: string; unitsSold: number; revenue: number }[] =
    project.gaTopProductsJson ? JSON.parse(project.gaTopProductsJson) : [];
  const topAddToCartProducts: { name: string; unitsAddedToCart: number }[] =
    project.gaTopAddToCartProductsJson ? JSON.parse(project.gaTopAddToCartProductsJson) : [];

  const channels = {
    organic: project.gaSessionsOrganic28d ?? 0,
    paid: project.gaSessionsPaid28d ?? 0,
    direct: project.gaSessionsDirect28d ?? 0,
    referral: project.gaSessionsReferral28d ?? 0,
    ai: project.gaSessionsAi28d ?? 0,
  };
  const channelsTotal = channels.organic + channels.paid + channels.direct + channels.referral + channels.ai;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Analiticas (ultimos 28 dias)</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Datos reales de Google Analytics para {project.domain}.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors"
        >
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!hasData ? (
        <p className="text-xs text-neutral-400">
          Dale a &quot;Actualizar&quot; para traer tus datos de Analytics.
        </p>
      ) : (
        <>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4">
            <p className="text-[14px] text-emerald-700 uppercase tracking-wide font-medium mb-2">
              Ventas (ecommerce de GA4)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                label="Ingresos"
                value={(project.gaRevenue28d ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
              />
              <StatCard label="Pedidos" value={String(project.gaTransactions28d ?? 0)} />
              <StatCard
                label="Ticket promedio"
                value={(project.gaAvgOrderValue28d ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
              />
            </div>
          </div>

          {(project.gaRevenue28d ?? 0) === 0 && (project.gaTransactions28d ?? 0) === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-amber-800 mb-1">
                Ingresos y pedidos en cero — probablemente falta configurar el ecommerce de GA4
              </p>
              <p className="text-[13px] text-amber-700/80 mb-3">
                Esto no es un error de la app: significa que Google Analytics no esta recibiendo
                los eventos de compra de tu tienda. Revisa esto en orden:
              </p>
              <ol className="text-[13px] text-amber-800 flex flex-col gap-2 list-decimal pl-4">
                <li>
                  En tu admin de Shopify ve a{" "}
                  <a
                    href={`https://${project.domain}/admin/settings/customer-events`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-900"
                  >
                    Configuracion → Eventos del cliente
                  </a>{" "}
                  y confirma que la app/pixel de Google (Google &amp; YouTube o Google Analytics) este
                  agregada y activa, no solo instalada.
                </li>
                <li>
                  Verifica que el <strong>Measurement ID</strong> (empieza con &quot;G-&quot;) que Shopify
                  esta usando sea el mismo property de GA4 que conectaste aqui en Conexiones — dos
                  propiedades distintas es la causa mas comun de este problema.
                </li>
                <li>
                  En GA4 mismo, ve a Admin → Estructura de datos → Flujos de datos y confirma que el
                  flujo web tenga la <strong>medicion mejorada de ecommerce</strong> activada.
                </li>
                <li>
                  Haz una compra de prueba y revisa el reporte <strong>Tiempo real</strong> de GA4 — deberias
                  ver el evento <code className="bg-amber-100 rounded px-1">purchase</code> aparecer en
                  segundos. Si no aparece, el problema esta en la conexion Shopify↔GA4, no en esta app.
                </li>
              </ol>
            </div>
          )}

          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <p className="text-sm font-medium text-neutral-900 mb-2">Pedidos por dia</p>
            <OrdersChart data={ordersByDate} />
            {ordersByDate.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto border border-neutral-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50">
                    <tr className="text-neutral-400">
                      <th className="text-left font-normal px-3 py-1.5">Fecha</th>
                      <th className="text-right font-normal px-3 py-1.5">Pedidos</th>
                      <th className="text-right font-normal px-3 py-1.5">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...ordersByDate].reverse().map((d) => (
                      <tr key={d.date} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 py-1.5 text-neutral-600">
                          {new Date(`${d.date}T00:00:00`).toLocaleDateString("es-MX", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-1.5 text-right text-neutral-700">{d.transactions}</td>
                        <td className="px-3 py-1.5 text-right text-neutral-700">
                          {d.revenue.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[13px] text-neutral-400 mt-2">
              GA4 no expone el detalle de pedidos individuales (numero de
              orden, productos por orden) via API sin conectar BigQuery —
              esta tabla es el nivel de detalle diario que si esta disponible.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Usuarios nuevos" value={(project.gaNewUsers28d ?? 0).toLocaleString("es-MX")} />
            <StatCard
              label="Tasa de interaccion"
              value={project.gaEngagementRate28d != null ? `${Math.round(project.gaEngagementRate28d * 100)}%` : "—"}
            />
            <StatCard
              label="Duracion prom. sesion"
              value={project.gaAvgSessionSec28d != null ? `${Math.round(project.gaAvgSessionSec28d / 60)} min` : "—"}
            />
            <StatCard
              label="Dispositivo principal"
              value={
                deviceTotal > 0
                  ? device.mobile >= device.desktop
                    ? `Movil (${Math.round((device.mobile / deviceTotal) * 100)}%)`
                    : `Escritorio (${Math.round((device.desktop / deviceTotal) * 100)}%)`
                  : "—"
              }
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Paginas mas visitadas</p>
              {topPages.length === 0 ? (
                <p className="text-xs text-neutral-400">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
                  {topPages.map((p) => (
                    <a
                      key={p.path}
                      href={`https://${project.domain}${p.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs hover:bg-neutral-100 transition-colors"
                    >
                      <span className="text-neutral-700 hover:text-[#228449] hover:underline truncate">{p.path}</span>
                      <span className="text-neutral-400 shrink-0">{p.views.toLocaleString("es-MX")}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Paises con mas visitas</p>
              {topCountries.length === 0 ? (
                <p className="text-xs text-neutral-400">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topCountries.map((c) => (
                    <div key={c.country} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                      <span className="text-neutral-700 truncate">{c.country}</span>
                      <span className="text-neutral-400 shrink-0">{c.sessions.toLocaleString("es-MX")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {deviceTotal > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Dispositivos</p>
              <div className="flex h-3 rounded-md overflow-hidden">
                <div className="bg-[#228449]" style={{ width: `${(device.mobile / deviceTotal) * 100}%` }} />
                <div className="bg-emerald-500" style={{ width: `${(device.desktop / deviceTotal) * 100}%` }} />
                <div className="bg-amber-500" style={{ width: `${(device.tablet / deviceTotal) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-neutral-500">
                <span><span className="inline-block w-2 h-2 rounded-full bg-[#228449] mr-1.5" />Movil {Math.round((device.mobile / deviceTotal) * 100)}%</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />Escritorio {Math.round((device.desktop / deviceTotal) * 100)}%</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />Tablet {Math.round((device.tablet / deviceTotal) * 100)}%</span>
              </div>
            </div>
          )}

          {channelsTotal > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Canales de trafico</p>
              <div className="flex h-3 rounded-md overflow-hidden">
                <div className="bg-emerald-500" style={{ width: `${(channels.organic / channelsTotal) * 100}%` }} />
                <div className="bg-[#228449]" style={{ width: `${(channels.paid / channelsTotal) * 100}%` }} />
                <div className="bg-neutral-400" style={{ width: `${(channels.direct / channelsTotal) * 100}%` }} />
                <div className="bg-amber-500" style={{ width: `${(channels.referral / channelsTotal) * 100}%` }} />
                <div className="bg-purple-500" style={{ width: `${(channels.ai / channelsTotal) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-neutral-500">
                <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />Organico {channels.organic.toLocaleString("es-MX")}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-[#228449] mr-1.5" />Pago {channels.paid.toLocaleString("es-MX")}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-neutral-400 mr-1.5" />Directo {channels.direct.toLocaleString("es-MX")}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />Referencia {channels.referral.toLocaleString("es-MX")}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1.5" />IA {channels.ai.toLocaleString("es-MX")}</span>
              </div>
            </div>
          )}

          {Object.values(salesBreakdowns).some((rows) => rows.length > 0) && (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-0.5">
                <p className="text-sm font-medium text-neutral-900">Ventas</p>
              </div>
              <p className="text-neutral-400 text-[14px] mb-3">
                De donde vienen tus ventas reales, segun lo que detecta GA4.
                {salesBreakdown === "landingPage" && (
                  <>
                    {" "}
                    Google no entrega la palabra clave organica real (viene
                    oculta como &ldquo;(not provided)&rdquo; desde 2013) — esto
                    muestra que paginas generaron esas ventas; cruza esas
                    URLs con Rankings o SEO IA para ver que keywords reales
                    les llegan.
                  </>
                )}
              </p>

              <div className="flex bg-white border border-neutral-200 rounded-md p-0.5 text-[14px] flex-wrap w-fit mb-4">
                {(Object.keys(SALES_BREAKDOWN_LABELS) as SalesBreakdownKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSalesBreakdown(key)}
                    className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
                      salesBreakdown === key ? "bg-[#228449] text-white font-medium" : "text-neutral-500 hover:bg-neutral-100"
                    }`}
                  >
                    {SALES_BREAKDOWN_LABELS[key].tab}
                  </button>
                ))}
              </div>

              {salesBreakdowns[salesBreakdown].length === 0 ? (
                <p className="text-xs text-neutral-400">Sin datos.</p>
              ) : (
                <>
                  <SalesBreakdownChart data={salesBreakdowns[salesBreakdown]} />

                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-neutral-400 border-b border-neutral-200">
                          <th className="text-left font-normal px-2 py-1.5">
                            {SALES_BREAKDOWN_LABELS[salesBreakdown].column}
                          </th>
                          <th className="text-right font-normal px-2 py-1.5">Ventas</th>
                          <th className="text-right font-normal px-2 py-1.5">Pedidos</th>
                          <th className="text-right font-normal px-2 py-1.5">Sesiones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesBreakdowns[salesBreakdown].map((row, i) => (
                          <tr key={`${row.label}-${i}`} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-2 py-1.5 text-neutral-700 max-w-xs truncate" title={row.label}>
                              {row.label}
                            </td>
                            <td className="px-2 py-1.5 text-right text-neutral-900 font-medium whitespace-nowrap">
                              {row.revenue.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-2 py-1.5 text-right text-neutral-500">{row.transactions.toLocaleString("es-MX")}</td>
                            <td className="px-2 py-1.5 text-right text-neutral-400">{row.sessions.toLocaleString("es-MX")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {salesBreakdowns[salesBreakdown].every((r) => r.revenue === 0) && (
                    <p className="text-[14px] text-neutral-400 mt-2">
                      Todo muestra $0 en ventas — probablemente el ecommerce
                      tracking de GA4 no esta configurado en la tienda. Las
                      sesiones si son reales.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Fuentes de trafico</p>
              {topSources.length === 0 ? (
                <p className="text-xs text-neutral-400">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topSources.map((s) => (
                    <div key={s.name} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                      <span className="text-neutral-700 truncate">{s.name}</span>
                      <span className="text-neutral-400 shrink-0">{s.sessions.toLocaleString("es-MX")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Medio</p>
              {topMediums.length === 0 ? (
                <p className="text-xs text-neutral-400">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topMediums.map((m) => (
                    <div key={m.name} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                      <span className="text-neutral-700 truncate">{m.name}</span>
                      <span className="text-neutral-400 shrink-0">{m.sessions.toLocaleString("es-MX")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Campañas (UTM)</p>
              {topCampaigns.length === 0 ? (
                <p className="text-xs text-neutral-400">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topCampaigns.map((s) => (
                    <div key={s.source} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                      <span className="text-neutral-700 truncate">{s.source}</span>
                      <span className="text-neutral-400 shrink-0">{s.sessions.toLocaleString("es-MX")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Productos mas vendidos</p>
              {topProducts.length === 0 ? (
                <p className="text-xs text-neutral-400">
                  Sin datos — necesita el seguimiento de ecommerce de GA4 activado.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topProducts.map((p) => (
                    <div key={p.name} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                      <span className="text-neutral-700 truncate">{p.name}</span>
                      <span className="text-neutral-400 shrink-0 text-right">
                        {p.unitsSold} uds ·{" "}
                        {p.revenue.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
              <p className="text-sm font-medium text-neutral-900 mb-2">Productos mas agregados al carrito</p>
              {topAddToCartProducts.length === 0 ? (
                <p className="text-xs text-neutral-400">
                  Sin datos — necesita el seguimiento de ecommerce de GA4 activado.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topAddToCartProducts.map((p) => (
                    <div key={p.name} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white text-xs">
                      <span className="text-neutral-700 truncate">{p.name}</span>
                      <span className="text-neutral-400 shrink-0">{p.unitsAddedToCart} uds</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GaSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [properties, setProperties] = useState<GaProperty[]>([]);
  const [propertyId, setPropertyId] = useState(project.gaPropertyId ?? "");
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = Boolean(project.gaConnectedAt);
  const hasStats = project.gaStatsUpdatedAt != null;

  useEffect(() => {
    if (!connected || project.gaPropertyId) return;
    setLoadingProperties(true);
    setError(null);
    fetch(`/api/projects/${project.id}/ga/properties`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProperties(data.properties ?? []);
        if (data.properties?.[0]) setPropertyId(data.properties[0].propertyId);
      })
      .catch((err) => setError(err.message || "Error al listar propiedades"))
      .finally(() => setLoadingProperties(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, project.gaPropertyId, project.id]);

  async function handleSaveProperty(e: React.FormEvent) {
    e.preventDefault();
    setSavingProperty(true);
    setError(null);
    try {
      await fetch(`/api/projects/${project.id}/ga/set-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      router.refresh();
    } finally {
      setSavingProperty(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/ga/refresh-stats`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}/ga/disconnect`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-3 bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3.5">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            Google Analytics (GA4)
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Cruza posiciones con trafico y conversiones reales de {project.domain}.
          </p>
        </div>
        <a
          href={`/api/ga/auth?projectId=${project.id}`}
          className="text-sm bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-900 font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          Conectar Google Analytics
        </a>
      </div>
    );
  }

  return (
    <div className="bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-neutral-700">Google Analytics conectado</p>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-xs text-neutral-400 hover:text-red-600 transition-colors"
        >
          Desconectar
        </button>
      </div>

      {!project.gaPropertyId ? (
        <form onSubmit={handleSaveProperty} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-neutral-500">Propiedad GA4</label>
            {loadingProperties ? (
              <p className="text-xs text-neutral-400 py-1.5">Cargando propiedades...</p>
            ) : properties.length > 0 ? (
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors w-64"
              >
                {properties.map((p) => (
                  <option key={p.propertyId} value={p.propertyId}>
                    {p.accountName} — {p.displayName} ({p.propertyId})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-neutral-400 py-1.5">
                No se encontraron propiedades accesibles con esta cuenta.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingProperty || !propertyId}
            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5"
          >
            Guardar
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-neutral-500">
            Property{" "}
            <span className="text-neutral-900 font-medium">
              {project.gaPropertyId}
            </span>
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs bg-white border border-neutral-300 hover:border-neutral-400 disabled:opacity-50 text-neutral-900 font-medium rounded-md px-3 py-1.5"
          >
            {refreshing ? "Actualizando..." : "Actualizar metricas"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hasStats && (
        <div className="flex flex-wrap gap-4 text-xs text-neutral-600 border-t border-neutral-200 pt-2">
          <span>
            <strong className="text-neutral-900">
              {(project.gaSessions28d ?? 0).toLocaleString("es-MX")}
            </strong>{" "}
            sesiones (28d)
          </span>
          <span>
            <strong className="text-neutral-900">
              {(project.gaUsers28d ?? 0).toLocaleString("es-MX")}
            </strong>{" "}
            usuarios (28d)
          </span>
          <span>
            <strong className="text-neutral-900">
              {(project.gaConversions28d ?? 0).toLocaleString("es-MX")}
            </strong>{" "}
            conversiones (28d)
          </span>
        </div>
      )}
    </div>
  );
}

function ShareLinkSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    project.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/${project.shareToken}`
      : null;

  async function handleEnable() {
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}/share/enable`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}/share/disable`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <p className="text-sm text-neutral-600">
        Genera un link publico de solo lectura para este proyecto. Quien lo
        tenga puede ver el dashboard (sin editar, conectar ni borrar nada)
        sin necesidad de usuario ni contraseña. Ideal para compartirselo
        directo a tu cliente.
      </p>

      {!project.shareToken ? (
        <button
          onClick={handleEnable}
          disabled={loading}
          className="mt-3 text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3.5 py-2 transition-colors"
        >
          {loading ? "Generando..." : "Generar link publico"}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              readOnly
              value={shareUrl ?? ""}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-[240px] bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700"
            />
            <button
              onClick={handleCopy}
              className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 font-medium rounded-md px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              {copied ? "Copiado ✓" : "Copiar link"}
            </button>
          </div>
          <button
            onClick={handleDisable}
            disabled={loading}
            className="self-start text-xs text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 rounded-lg px-2.5 py-1 transition-colors"
          >
            {loading ? "Desactivando..." : "Desactivar link (invalida el anterior)"}
          </button>
        </div>
      )}
    </div>
  );
}

function LocationSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [locationCode, setLocationCode] = useState(project.locationCode);
  const [languageCode, setLanguageCode] = useState(project.languageCode);
  const [saving, setSaving] = useState(false);

  const dirty =
    locationCode !== project.locationCode ||
    languageCode !== project.languageCode;

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationCode, languageCode }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-end gap-2 bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex flex-col gap-1">
        <label className="text-[14px] text-neutral-500">Pais</label>
        <select
          value={locationCode}
          onChange={(e) => setLocationCode(e.target.value)}
          className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        >
          {LOCATIONS.map((loc) => (
            <option key={loc.code} value={loc.code}>
              {loc.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[14px] text-neutral-500">Idioma</label>
        <select
          value={languageCode}
          onChange={(e) => setLanguageCode(e.target.value)}
          className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      {dirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-2"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      )}
      <p className="text-[14px] text-neutral-400 pb-2">
        Aplica a todas las keywords de este proyecto.
      </p>
    </div>
  );
}

function formatMoney(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

interface TopSellingResult {
  source: "merchant" | "algorithm" | "none";
  collectionTitle: string | null;
  items: { title: string; handle: string }[];
}

// ecommerceTopSellingJson used to store a plain array before the
// merchant-collection-vs-algorithm distinction was added — normalize both
// shapes so projects that haven't re-run "Analizar tienda" yet don't crash.
function parseTopSelling(json: string | null): TopSellingResult {
  if (!json) return { source: "none", collectionTitle: null, items: [] };
  const parsed = JSON.parse(json);
  if (Array.isArray(parsed)) {
    return { source: "algorithm", collectionTitle: null, items: parsed };
  }
  return {
    source: parsed?.source ?? "none",
    collectionTitle: parsed?.collectionTitle ?? null,
    items: parsed?.items ?? [],
  };
}

function CompetitorShopifyDetails({
  competitor,
}: {
  competitor: ProjectDTO["competitors"][number];
}) {
  const vendors: { name: string; count: number }[] = competitor.ecommerceTopVendorsJson
    ? JSON.parse(competitor.ecommerceTopVendorsJson)
    : [];
  const types: { name: string; count: number }[] = competitor.ecommerceTopTypesJson
    ? JSON.parse(competitor.ecommerceTopTypesJson)
    : [];
  const tags: { name: string; count: number }[] = competitor.ecommerceTopTagsJson
    ? JSON.parse(competitor.ecommerceTopTagsJson)
    : [];
  const topSellingResult = parseTopSelling(competitor.ecommerceTopSellingJson);
  const topSelling = topSellingResult.items;

  const hasAnything =
    vendors.length > 0 ||
    types.length > 0 ||
    tags.length > 0 ||
    topSelling.length > 0 ||
    competitor.ecommerceAvgPrice != null ||
    competitor.ecommerceNewestProductAt != null;

  if (!hasAnything) return null;

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-col gap-3 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {competitor.ecommercePriceMin != null && competitor.ecommercePriceMax != null && (
          <div>
            <p className="text-neutral-400">Rango de precios</p>
            <p className="text-neutral-800 font-medium">
              {formatMoney(competitor.ecommercePriceMin)} – {formatMoney(competitor.ecommercePriceMax)}
            </p>
          </div>
        )}
        {competitor.ecommerceAvgPrice != null && (
          <div>
            <p className="text-neutral-400">Precio promedio</p>
            <p className="text-neutral-800 font-medium">{formatMoney(competitor.ecommerceAvgPrice)}</p>
          </div>
        )}
        {competitor.ecommerceTotalVariants != null && (
          <div>
            <p className="text-neutral-400">Variantes</p>
            <p className="text-neutral-800 font-medium">{competitor.ecommerceTotalVariants}</p>
          </div>
        )}
        {competitor.ecommerceNewestProductAt != null && (
          <div>
            <p className="text-neutral-400">Ultimo producto agregado</p>
            <p className="text-neutral-800 font-medium">
              {new Date(competitor.ecommerceNewestProductAt).toLocaleDateString("es-MX", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        )}
      </div>

      {topSelling.length > 0 && topSellingResult.source === "merchant" && (
        <div>
          <p className="text-neutral-400 mb-1">
            {`Populares (coleccion "${topSellingResult.collectionTitle}")`}
          </p>
          <ul className="flex flex-col gap-0.5">
            {topSelling.map((p) => (
              <li key={p.handle} className="text-neutral-700 truncate">
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vendors.length > 0 && (
        <div>
          <p className="text-neutral-400 mb-1">Marcas mas comunes</p>
          <div className="flex flex-wrap gap-1.5">
            {vendors.map((v) => (
              <a
                key={v.name}
                href={`https://${competitor.domain}/collections/all?filter.p.vendor=${encodeURIComponent(v.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-neutral-200 hover:border-[#228449] hover:text-[#228449] rounded-md px-2 py-0.5 text-neutral-600 transition-colors"
              >
                {v.name} <span className="text-neutral-400">({v.count})</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {types.length > 0 && (
        <div>
          <p className="text-neutral-400 mb-1">Categorias / tipos</p>
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <a
                key={t.name}
                href={`https://${competitor.domain}/collections/all?filter.p.product_type=${encodeURIComponent(t.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-neutral-200 hover:border-[#228449] hover:text-[#228449] rounded-md px-2 py-0.5 text-neutral-600 transition-colors"
              >
                {t.name} <span className="text-neutral-400">({t.count})</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <p className="text-neutral-400 mb-1">Tags mas usados</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <a
                key={t.name}
                href={`https://${competitor.domain}/collections/all?filter.p.tag=${encodeURIComponent(t.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-neutral-200 hover:border-[#228449] hover:text-[#228449] rounded-md px-2 py-0.5 text-neutral-600 transition-colors"
              >
                {t.name} <span className="text-neutral-400">({t.count})</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: ProjectDTO["competitors"][number] }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const sync = useSyncStatus();
  const [showKeywords, setShowKeywords] = useState(false);
  const [kwViewMode, setKwViewMode] = useState<"keywords" | "pages">("keywords");
  const [kwSortBy, setKwSortBy] = useState<"keyword" | "volume" | "position">("position");
  const [kwSortDir, setKwSortDir] = useState<"asc" | "desc">("asc");
  const [pageSortBy, setPageSortBy] = useState<"url" | "count" | "volume" | "position">("count");
  const [pageSortDir, setPageSortDir] = useState<"asc" | "desc">("desc");

  const hasData = competitor.trafficCheckedAt != null || competitor.ecommerceCheckedAt != null;
  const rankedKeywords: { keyword: string; position: number | null; searchVolume: number | null; url: string | null }[] =
    competitor.rankedKeywordsJson ? JSON.parse(competitor.rankedKeywordsJson) : [];

  function toggleKwSort(column: "keyword" | "volume" | "position") {
    if (kwSortBy === column) {
      setKwSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKwSortBy(column);
      setKwSortDir(column === "keyword" ? "asc" : column === "position" ? "asc" : "desc");
    }
  }

  const sortedRankedKeywords = [...rankedKeywords].sort((a, b) => {
    const dir = kwSortDir === "asc" ? 1 : -1;
    if (kwSortBy === "keyword") return a.keyword.localeCompare(b.keyword) * dir;
    const key = kwSortBy === "volume" ? "searchVolume" : "position";
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * dir;
  });

  // Ahrefs-style "top pages" view: DataForSEO gives us ranked keywords, not
  // page-level traffic/backlinks (no Site Explorer-equivalent API here), so
  // we approximate it by grouping the same ranked-keywords list by URL.
  type PageGroup = {
    url: string;
    keywordCount: number;
    topKeyword: string;
    topVolume: number | null;
    totalVolume: number;
    bestPosition: number | null;
  };
  const pagesByUrl = new Map<string, PageGroup>();
  for (const k of rankedKeywords) {
    if (!k.url) continue;
    const existing = pagesByUrl.get(k.url);
    if (!existing) {
      pagesByUrl.set(k.url, {
        url: k.url,
        keywordCount: 1,
        topKeyword: k.keyword,
        topVolume: k.searchVolume,
        totalVolume: k.searchVolume ?? 0,
        bestPosition: k.position,
      });
    } else {
      existing.keywordCount++;
      existing.totalVolume += k.searchVolume ?? 0;
      if ((k.searchVolume ?? 0) > (existing.topVolume ?? 0)) {
        existing.topKeyword = k.keyword;
        existing.topVolume = k.searchVolume;
      }
      if (existing.bestPosition == null || (k.position != null && k.position < existing.bestPosition)) {
        existing.bestPosition = k.position;
      }
    }
  }
  const pageGroups = Array.from(pagesByUrl.values());

  function togglePageSort(column: "url" | "count" | "volume" | "position") {
    if (pageSortBy === column) {
      setPageSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setPageSortBy(column);
      setPageSortDir(column === "url" || column === "position" ? "asc" : "desc");
    }
  }

  const sortedPageGroups = [...pageGroups].sort((a, b) => {
    const dir = pageSortDir === "asc" ? 1 : -1;
    if (pageSortBy === "url") return a.url.localeCompare(b.url) * dir;
    if (pageSortBy === "count") return (a.keywordCount - b.keywordCount) * dir;
    if (pageSortBy === "volume") return (a.totalVolume - b.totalVolume) * dir;
    const va = a.bestPosition;
    const vb = b.bestPosition;
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * dir;
  });

  async function handleRefresh() {
    setRefreshing(true);
    startProgress();
    sync.begin(`competitor-${competitor.id}`, `Actualizando ${competitor.domain}`);
    try {
      await fetch(`/api/competitors/${competitor.id}/refresh`, { method: "POST" });
      finishProgress();
      router.refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 300);
      sync.end(`competitor-${competitor.id}`);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await fetch(`/api/competitors/${competitor.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="bg-surface-low rounded-xl px-4 py-3 shadow-elevation-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-900 flex items-center gap-1.5">
            {competitor.domain}
            <a
              href={`https://${competitor.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir ${competitor.domain}`}
              className="text-neutral-400 hover:text-[#228449] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6M10 14 21 3" />
              </svg>
            </a>
          </p>
          {competitor.ecommerceIsShopify && (
            <span className="text-[13px] uppercase tracking-wide bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">
              Shopify
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors"
          >
            {refreshing ? "Analizando..." : hasData ? "Actualizar" : "Analizar"}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-neutral-400 hover:text-red-600 transition-colors"
          >
            Quitar
          </button>
        </div>
      </div>

      {refreshing && (
        <div className="mt-3">
          <ProgressBar percent={progress} />
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
          {competitor.ecommerceProductCount != null && (
            <div>
              <p className="text-neutral-400">Productos</p>
              <p className="text-neutral-800 font-medium">{competitor.ecommerceProductCount}</p>
            </div>
          )}
          {competitor.organicTrafficEstimate != null && (
            <div>
              <p className="text-neutral-400">Trafico organico est.</p>
              <p className="text-neutral-800 font-medium">
                {competitor.organicTrafficEstimate.toLocaleString("es-MX")}/mes
              </p>
            </div>
          )}
          {competitor.paidTrafficEstimate != null && (
            <div>
              <p className="text-neutral-400">Trafico pago est.</p>
              <p className="text-neutral-800 font-medium">
                {competitor.paidTrafficEstimate.toLocaleString("es-MX")}/mes
              </p>
            </div>
          )}
          {competitor.organicKeywords != null && (
            <div>
              <p className="text-neutral-400">Keywords posicionadas</p>
              <p className="text-neutral-800 font-medium">
                {competitor.organicKeywords.toLocaleString("es-MX")}
              </p>
            </div>
          )}
        </div>
      )}

      {competitor.ecommerceIsShopify && hasData && <CompetitorShopifyDetails competitor={competitor} />}

      {rankedKeywords.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => setShowKeywords((v) => !v)}
              className="text-xs text-neutral-500 hover:text-[#228449] transition-colors"
            >
              {showKeywords ? "Ocultar" : "Ver"} keywords posicionadas ({rankedKeywords.length}) {showKeywords ? "▲" : "▼"}
            </button>
            {showKeywords && (
              <div className="flex bg-neutral-100 rounded-md p-0.5 text-[14px]">
                <button
                  onClick={() => setKwViewMode("keywords")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    kwViewMode === "keywords" ? "bg-white shadow-sm text-neutral-800" : "text-neutral-500"
                  }`}
                >
                  Por keyword
                </button>
                <button
                  onClick={() => setKwViewMode("pages")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    kwViewMode === "pages" ? "bg-white shadow-sm text-neutral-800" : "text-neutral-500"
                  }`}
                >
                  Por página ({pageGroups.length})
                </button>
              </div>
            )}
          </div>
          {showKeywords && kwViewMode === "keywords" && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-neutral-400">
                    <th className="text-left font-normal px-2 py-1.5">
                      <SortHeader label="Keyword" active={kwSortBy === "keyword"} dir={kwSortDir} onClick={() => toggleKwSort("keyword")} />
                    </th>
                    <th className="text-left font-normal px-2 py-1.5">URL</th>
                    <th className="text-right font-normal px-2 py-1.5">
                      <span className="inline-flex justify-end">
                        <SortHeader label="Volumen/mes" active={kwSortBy === "volume"} dir={kwSortDir} onClick={() => toggleKwSort("volume")} />
                      </span>
                    </th>
                    <th className="text-right font-normal px-2 py-1.5">
                      <span className="inline-flex justify-end">
                        <SortHeader label="Posicion" active={kwSortBy === "position"} dir={kwSortDir} onClick={() => toggleKwSort("position")} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRankedKeywords.map((k) => (
                    <tr key={k.keyword} className="odd:bg-neutral-50">
                      <td className="px-2 py-1.5 text-neutral-700 whitespace-nowrap">{k.keyword}</td>
                      <td className="px-2 py-1.5 max-w-[220px]">
                        {k.url ? (
                          <a
                            href={k.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-[#228449] hover:underline truncate block"
                          >
                            {k.url.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-neutral-400 whitespace-nowrap">
                        {k.searchVolume != null ? `${k.searchVolume.toLocaleString("es-MX")}/mes` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-600 font-medium">
                          #{k.position ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showKeywords && kwViewMode === "pages" && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-neutral-400">
                    <th className="text-left font-normal px-2 py-1.5">
                      <SortHeader label="URL" active={pageSortBy === "url"} dir={pageSortDir} onClick={() => togglePageSort("url")} />
                    </th>
                    <th className="text-left font-normal px-2 py-1.5">Palabra clave principal</th>
                    <th className="text-right font-normal px-2 py-1.5">
                      <span className="inline-flex justify-end">
                        <SortHeader label="Keywords" active={pageSortBy === "count"} dir={pageSortDir} onClick={() => togglePageSort("count")} />
                      </span>
                    </th>
                    <th className="text-right font-normal px-2 py-1.5">
                      <span className="inline-flex justify-end">
                        <SortHeader label="Volumen/mes" active={pageSortBy === "volume"} dir={pageSortDir} onClick={() => togglePageSort("volume")} />
                      </span>
                    </th>
                    <th className="text-right font-normal px-2 py-1.5">
                      <span className="inline-flex justify-end">
                        <SortHeader label="Mejor posicion" active={pageSortBy === "position"} dir={pageSortDir} onClick={() => togglePageSort("position")} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPageGroups.map((p) => (
                    <tr key={p.url} className="odd:bg-neutral-50">
                      <td className="px-2 py-1.5 max-w-[220px]">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-700 hover:text-[#228449] hover:underline truncate block"
                        >
                          {p.url.replace(/^https?:\/\//, "")}
                        </a>
                      </td>
                      <td className="px-2 py-1.5 text-neutral-500 whitespace-nowrap">{p.topKeyword}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-600 font-medium">
                          {p.keywordCount}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-neutral-400 whitespace-nowrap">
                        {p.totalVolume > 0 ? `${p.totalVolume.toLocaleString("es-MX")}/mes` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-600 font-medium">
                          #{p.bestPosition ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {competitor.techDetectedJson &&
        (() => {
          const tech: { name: string; icon: string; url: string }[] = JSON.parse(
            competitor.techDetectedJson
          );
          const unique = Array.from(new Map(tech.map((t) => [t.name, t])).values());
          if (unique.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100">
              {unique.map((t) => (
                <span
                  key={t.name}
                  className="flex items-center gap-1 text-[14px] bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-600"
                >
                  <TechLogo url={t.url} icon={t.icon} size={14} />
                  {t.name}
                </span>
              ))}
            </div>
          );
        })()}
    </div>
  );
}

const X_METRIC_EXPLANATIONS: Record<XMetricKey, string> = {
  trafficValue:
    "lo que costaria comprar ese mismo trafico organico con anuncios de pago (Google Ads) en vez de aparecer gratis en los resultados. Entre mas alto, mas dinero en publicidad le esta ahorrando el SEO cada mes.",
};

interface BeatTask {
  keyword: string;
  searchVolume: number | null;
  competitorPosition: number;
  ownPosition: number | null;
}

function beatTaskLabel(t: BeatTask, competitorDomain: string): string {
  const vol = t.searchVolume ? ` (${t.searchVolume.toLocaleString("es-MX")} busquedas/mes)` : "";
  if (t.ownPosition == null) {
    return `Crea o mejora contenido para "${t.keyword}"${vol} — ${competitorDomain} esta en el puesto #${t.competitorPosition} y tu no apareces en el top 100.`;
  }
  return `Mejora tu posicion en "${t.keyword}"${vol} — estas en el puesto #${t.ownPosition}, ${competitorDomain} esta en el #${t.competitorPosition}.`;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportBeatTasksCsv(tasks: BeatTask[], competitorDomain: string, checked: Set<string>) {
  const header = ["Hecho", "Keyword", "Volumen", "Tu posicion", `Posicion ${competitorDomain}`, "Tarea"];
  const rows = tasks.map((t) => [
    checked.has(t.keyword) ? "Si" : "No",
    t.keyword,
    t.searchVolume != null ? String(t.searchVolume) : "",
    t.ownPosition != null ? String(t.ownPosition) : "",
    String(t.competitorPosition),
    beatTaskLabel(t, competitorDomain),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(`tareas-vs-${competitorDomain}.csv`, `﻿${csv}`, "text/csv;charset=utf-8");
}

// A plain HTML <table> saved with an Excel mime type/extension — Excel
// opens this natively, no spreadsheet library (and its dependency-security
// baggage) needed just to produce a table of text and numbers.
function exportBeatTasksExcel(tasks: BeatTask[], competitorDomain: string, checked: Set<string>) {
  const rows = tasks
    .map(
      (t) => `<tr>
        <td>${checked.has(t.keyword) ? "Si" : "No"}</td>
        <td>${t.keyword}</td>
        <td>${t.searchVolume ?? ""}</td>
        <td>${t.ownPosition ?? ""}</td>
        <td>${t.competitorPosition}</td>
        <td>${beatTaskLabel(t, competitorDomain).replace(/"/g, "&quot;")}</td>
      </tr>`
    )
    .join("");
  const html = `<html><head><meta charset="utf-8"></head><body>
    <table border="1">
      <tr><th>Hecho</th><th>Keyword</th><th>Volumen</th><th>Tu posicion</th><th>Posicion ${competitorDomain}</th><th>Tarea</th></tr>
      ${rows}
    </table>
  </body></html>`;
  downloadBlob(`tareas-vs-${competitorDomain}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
}

// No PDF library either — opens a plain print-styled window and lets the
// browser's own "Guardar como PDF" print destination handle it.
function exportBeatTasksPdf(tasks: BeatTask[], competitorDomain: string, checked: Set<string>) {
  const rows = tasks
    .map(
      (t) => `<li style="margin-bottom:8px;">
        <strong>${checked.has(t.keyword) ? "[x]" : "[ ]"}</strong>
        ${beatTaskLabel(t, competitorDomain).replace(/</g, "&lt;")}
      </li>`
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tareas vs ${competitorDomain}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
      h1 { font-size: 16px; }
      ol { padding-left: 20px; }
    </style>
    </head><body>
      <h1>Tareas para ganarle keywords a ${competitorDomain}</h1>
      <ol>${rows}</ol>
      <script>window.onload = () => window.print();</script>
    </body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function CompetitorComparisonOverview({
  project,
  detectButton,
}: {
  project: ProjectDTO;
  detectButton?: React.ReactNode;
}) {
  const router = useRouter();
  const [refreshingOwn, setRefreshingOwn] = useState(false);
  const sync = useSyncStatus();
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [intersectionByDomain, setIntersectionByDomain] = useState<
    Record<string, IntersectionKeywordRow[] | "loading" | "error">
  >({});
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());

  function toggleTaskChecked(keyword: string) {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  async function toggleIntersection(domain: string) {
    if (expandedDomain === domain) {
      setExpandedDomain(null);
      return;
    }
    setExpandedDomain(domain);
    if (intersectionByDomain[domain]) return;
    setIntersectionByDomain((prev) => ({ ...prev, [domain]: "loading" }));
    try {
      const res = await fetch(
        `/api/projects/${project.id}/competitors/intersection?domain=${encodeURIComponent(domain)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setIntersectionByDomain((prev) => ({ ...prev, [domain]: data.keywords ?? [] }));
    } catch {
      setIntersectionByDomain((prev) => ({ ...prev, [domain]: "error" }));
    }
  }

  const competitorsWithData = project.competitors.filter(
    (c) => c.organicTrafficEstimate != null || c.trafficValueEstimate != null
  );
  const ownHasData = project.domainOrganicTrafficEstimate != null;

  const allDomains = [
    project.domain,
    ...competitorsWithData.map((c) => c.domain),
  ];
  const [visibleDomains, setVisibleDomains] = useState<Set<string>>(new Set(allDomains));

  function toggleDomain(d: string) {
    setVisibleDomains((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function handleRefreshOwn() {
    setRefreshingOwn(true);
    sync.begin("own-traffic", "Analizando tu dominio");
    try {
      await fetch(`/api/projects/${project.id}/traffic-overview/refresh`, { method: "POST" });
      router.refresh();
    } finally {
      setRefreshingOwn(false);
      sync.end("own-traffic");
    }
  }

  const xMetric: XMetricKey = "trafficValue";

  const points: CompetitorPoint[] = [];
  if (ownHasData) {
    points.push({
      domain: project.domain,
      organicTraffic: project.domainOrganicTrafficEstimate ?? 0,
      trafficValue: project.domainTrafficValueEstimate ?? 0,
      organicKeywords: project.domainOrganicKeywords ?? 0,
      isOwn: true,
    });
  }
  for (const c of competitorsWithData) {
    points.push({
      domain: c.domain,
      organicTraffic: c.organicTrafficEstimate ?? 0,
      trafficValue: c.trafficValueEstimate ?? 0,
      organicKeywords: c.organicKeywords ?? 0,
      isOwn: false,
    });
  }

  const colorMap: Record<string, string> = {};
  points.forEach((p, i) => {
    colorMap[p.domain] = colorForCompetitorIndex(i);
  });
  const colorFor = (domain: string) => colorMap[domain] ?? "#a3a3a3";

  const visiblePoints = points.filter((p) => visibleDomains.has(p.domain));

  // "Tu proximo competidor a vencer" — of the competitors currently ahead
  // of you on organic traffic, the CLOSEST one (smallest traffic gap) is
  // the most realistic next target, rather than whoever's biggest overall.
  const ownTraffic = project.domainOrganicTrafficEstimate ?? 0;
  const nextCompetitor = ownHasData
    ? competitorsWithData
        .filter((c) => (c.organicTrafficEstimate ?? 0) > ownTraffic)
        .sort((a, b) => (a.organicTrafficEstimate ?? 0) - (b.organicTrafficEstimate ?? 0))[0]
    : null;

  type RankedKw = { keyword: string; position: number | null; searchVolume: number | null; url: string | null };
  const ownRankedKeywords: RankedKw[] = project.domainRankedKeywordsJson
    ? JSON.parse(project.domainRankedKeywordsJson)
    : [];
  const nextCompetitorKeywords: RankedKw[] = nextCompetitor?.rankedKeywordsJson
    ? JSON.parse(nextCompetitor.rankedKeywordsJson)
    : [];

  const ownPositionByKeyword = new Map<string, number | null>();
  for (const k of ownRankedKeywords) {
    ownPositionByKeyword.set(k.keyword.toLowerCase(), k.position);
  }

  const beatTasks = nextCompetitor
    ? nextCompetitorKeywords
        .filter((k) => k.position != null && k.position <= 20)
        .map((k) => ({
          keyword: k.keyword,
          searchVolume: k.searchVolume,
          competitorPosition: k.position as number,
          ownPosition: ownPositionByKeyword.get(k.keyword.toLowerCase()) ?? null,
        }))
        .filter((t) => t.ownPosition == null || t.ownPosition > t.competitorPosition)
        .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
        .slice(0, 15)
    : [];

  if (!ownHasData && competitorsWithData.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Competencia organica</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Compara tu trafico organico estimado contra tus competidores,
              como en SEMrush/Ahrefs.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefreshOwn}
              disabled={refreshingOwn}
              className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              {refreshingOwn ? "Analizando..." : "Analizar mi dominio"}
            </button>
            {detectButton}
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Analiza tu dominio arriba y agrega/analiza al menos un competidor
          abajo para ver la comparacion.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Competencia organica</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Cada circulo es un sitio. Mientras mas arriba y mas a la
            derecha este, mejor le esta yendo en Google. El tamaño del
            circulo combina su trafico organico y el valor de ese
            trafico — entre mas grande, mas peso tiene ese sitio en
            ambas metricas a la vez.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefreshOwn}
            disabled={refreshingOwn}
            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {refreshingOwn ? "Analizando..." : ownHasData ? "Actualizar mi dominio" : "Analizar mi dominio"}
          </button>
          {detectButton}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2.5 mb-3 text-[14px] text-neutral-500 leading-relaxed flex flex-col gap-1">
        <p>
          <strong className="text-neutral-700">Trafico organico estimado</strong>{" "}
          = cuantas visitas al mes calculamos que recibe ese sitio desde
          resultados gratuitos de Google (sin pagar anuncios), segun las
          palabras clave en las que aparece y que tan arriba sale en cada
          una.
        </p>
        <p>
          <strong className="text-neutral-700">{X_METRICS[xMetric].shortLabel}</strong>{" "}
          = {X_METRIC_EXPLANATIONS[xMetric]}
        </p>
        <p>
          <strong className="text-neutral-700">La linea punteada</strong> es
          el promedio del grupo que estas viendo (no un ideal fijo de la
          industria). Si tu circulo queda{" "}
          <strong className="text-neutral-700">arriba</strong> de la linea,
          sacas mas trafico organico del que es tipico para ese valor en el
          eje horizontal — vas mejor que tus competidores. Si queda{" "}
          <strong className="text-neutral-700">abajo</strong>, hay
          oportunidad de mejorar para acercarte a lo que logran ellos.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {points.map((p) => {
          const active = visibleDomains.has(p.domain);
          return (
            <button
              key={p.domain}
              type="button"
              onClick={() => toggleDomain(p.domain)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                active
                  ? "border-neutral-200 bg-white hover:border-neutral-300"
                  : "border-transparent bg-neutral-100 hover:bg-neutral-200"
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: active ? colorFor(p.domain) : "#d4d4d4" }}
              />
              <span
                className={
                  active
                    ? p.isOwn
                      ? "text-[#228449] font-medium"
                      : "text-neutral-600"
                    : "text-neutral-400"
                }
              >
                {p.domain}
                {p.isOwn ? " (tu)" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <CompetitorScatterChart points={visiblePoints} xMetric={xMetric} colorFor={colorFor} />

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-400 border-b border-neutral-200">
              <th className="text-left font-normal px-2 py-1.5">Dominio</th>
              <th className="text-right font-normal px-2 py-1.5">Keywords organicas</th>
              <th className="text-right font-normal px-2 py-1.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Trafico organico est.
                  <InfoTooltip text="Visitas mensuales estimadas que recibe ese sitio desde resultados gratuitos de Google, sin pagar anuncios." />
                </span>
              </th>
              <th className="text-right font-normal px-2 py-1.5">
                <span className="inline-flex items-center gap-1 justify-end">
                  Valor est.
                  <InfoTooltip text="Lo que costaria comprar ese mismo trafico con anuncios de pago (Google Ads) en vez de salir gratis en resultados organicos." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {points
              .slice()
              .sort((a, b) => b.organicTraffic - a.organicTraffic)
              .map((p) => {
                const intersection = intersectionByDomain[p.domain];
                return (
                <Fragment key={p.domain}>
                <tr className="hover:bg-neutral-50 transition-colors">
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorFor(p.domain) }}
                      />
                      <span className={p.isOwn ? "text-[#228449] font-medium" : "text-neutral-700"}>
                        {p.domain}
                        {p.isOwn ? " (tu)" : ""}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-600">
                    {p.isOwn ? (
                      p.organicKeywords.toLocaleString("es-MX")
                    ) : (
                      <button
                        onClick={() => toggleIntersection(p.domain)}
                        className="text-neutral-600 hover:text-[#228449] hover:underline underline-offset-2 transition-colors"
                        title="Ver las keywords en comun y su posicionamiento"
                      >
                        {p.organicKeywords.toLocaleString("es-MX")}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-600">
                    {p.organicTraffic.toLocaleString("es-MX")}/mes
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-600">
                    ${p.trafficValue.toLocaleString("es-MX")}/mes
                  </td>
                </tr>
                {expandedDomain === p.domain && !p.isOwn && (
                  <tr>
                    <td colSpan={4} className="bg-neutral-50 px-3 py-3">
                      {intersection === "loading" && (
                        <p className="text-neutral-400 text-xs">Cargando keywords en comun...</p>
                      )}
                      {intersection === "error" && (
                        <p className="text-red-600 text-xs">Error al cargar las keywords en comun.</p>
                      )}
                      {Array.isArray(intersection) && intersection.length === 0 && (
                        <p className="text-neutral-400 text-xs">No encontramos keywords en comun.</p>
                      )}
                      {Array.isArray(intersection) && intersection.length > 0 && (
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-neutral-400 border-b border-neutral-200">
                                <th className="text-left font-normal px-2 py-1">Keyword</th>
                                <th className="text-right font-normal px-2 py-1">Volumen</th>
                                <th className="text-right font-normal px-2 py-1">Tu posicion</th>
                                <th className="text-right font-normal px-2 py-1">Posicion de {p.domain}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {intersection.map((k) => (
                                <tr key={k.keyword} className="border-t border-neutral-100">
                                  <td className="px-2 py-1 text-neutral-700">{k.keyword}</td>
                                  <td className="px-2 py-1 text-right text-neutral-500">
                                    {k.searchVolume != null ? k.searchVolume.toLocaleString("es-MX") : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {k.ownUrl ? (
                                      <a
                                        href={k.ownUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#228449] font-medium hover:underline"
                                      >
                                        #{k.ownPosition}
                                      </a>
                                    ) : (
                                      <span className="text-neutral-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {k.competitorUrl ? (
                                      <a
                                        href={k.competitorUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-neutral-700 font-medium hover:underline"
                                      >
                                        #{k.competitorPosition}
                                      </a>
                                    ) : (
                                      <span className="text-neutral-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>

    {nextCompetitor && (
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <p className="text-sm font-medium text-neutral-900">Tu proximo competidor a vencer</p>
        <p className="text-neutral-500 text-xs mt-0.5 mb-3">
          De los competidores que te ganan en trafico organico,{" "}
          <strong className="text-neutral-700">{nextCompetitor.domain}</strong> es el mas
          cercano a ti — el objetivo mas realista para superar primero.
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400 border-b border-neutral-200">
                <th className="text-left font-normal px-2 py-1.5"></th>
                <th className="text-right font-normal px-2 py-1.5 text-[#228449]">Tu ({project.domain})</th>
                <th className="text-right font-normal px-2 py-1.5 text-neutral-700">{nextCompetitor.domain}</th>
                <th className="text-right font-normal px-2 py-1.5">Brecha</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-neutral-100">
                <td className="px-2 py-1.5 text-neutral-500">Keywords organicas</td>
                <td className="px-2 py-1.5 text-right text-neutral-700">
                  {(project.domainOrganicKeywords ?? 0).toLocaleString("es-MX")}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-700">
                  {(nextCompetitor.organicKeywords ?? 0).toLocaleString("es-MX")}
                </td>
                <td className="px-2 py-1.5 text-right text-red-600">
                  +{Math.max(0, (nextCompetitor.organicKeywords ?? 0) - (project.domainOrganicKeywords ?? 0)).toLocaleString("es-MX")}
                </td>
              </tr>
              <tr className="border-t border-neutral-100">
                <td className="px-2 py-1.5 text-neutral-500">Trafico organico est./mes</td>
                <td className="px-2 py-1.5 text-right text-neutral-700">
                  {ownTraffic.toLocaleString("es-MX")}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-700">
                  {(nextCompetitor.organicTrafficEstimate ?? 0).toLocaleString("es-MX")}
                </td>
                <td className="px-2 py-1.5 text-right text-red-600">
                  +{Math.max(0, (nextCompetitor.organicTrafficEstimate ?? 0) - ownTraffic).toLocaleString("es-MX")}
                </td>
              </tr>
              <tr className="border-t border-neutral-100">
                <td className="px-2 py-1.5 text-neutral-500">Valor del trafico est./mes</td>
                <td className="px-2 py-1.5 text-right text-neutral-700">
                  ${(project.domainTrafficValueEstimate ?? 0).toLocaleString("es-MX")}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-700">
                  ${(nextCompetitor.trafficValueEstimate ?? 0).toLocaleString("es-MX")}
                </td>
                <td className="px-2 py-1.5 text-right text-red-600">
                  +${Math.max(0, (nextCompetitor.trafficValueEstimate ?? 0) - (project.domainTrafficValueEstimate ?? 0)).toLocaleString("es-MX")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          onClick={() => toggleIntersection(nextCompetitor.domain)}
          className="text-[13px] text-[#228449] hover:underline underline-offset-2 mb-4 inline-block"
        >
          {expandedDomain === nextCompetitor.domain ? "Ocultar" : "Ver"} palabras clave en comun y su posicionamiento →
        </button>

        {expandedDomain === nextCompetitor.domain && (
          <div className="mb-4">
            {intersectionByDomain[nextCompetitor.domain] === "loading" && (
              <p className="text-neutral-400 text-xs">Cargando keywords en comun...</p>
            )}
            {intersectionByDomain[nextCompetitor.domain] === "error" && (
              <p className="text-red-600 text-xs">Error al cargar las keywords en comun.</p>
            )}
            {Array.isArray(intersectionByDomain[nextCompetitor.domain]) &&
              (intersectionByDomain[nextCompetitor.domain] as IntersectionKeywordRow[]).length === 0 && (
                <p className="text-neutral-400 text-xs">No encontramos keywords en comun.</p>
              )}
            {Array.isArray(intersectionByDomain[nextCompetitor.domain]) &&
              (intersectionByDomain[nextCompetitor.domain] as IntersectionKeywordRow[]).length > 0 && (
                <div className="max-h-64 overflow-y-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-50">
                      <tr className="text-neutral-400 border-b border-neutral-200">
                        <th className="text-left font-normal px-2 py-1.5">Keyword</th>
                        <th className="text-right font-normal px-2 py-1.5">Volumen</th>
                        <th className="text-right font-normal px-2 py-1.5">Tu posicion</th>
                        <th className="text-right font-normal px-2 py-1.5">Posicion de {nextCompetitor.domain}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(intersectionByDomain[nextCompetitor.domain] as IntersectionKeywordRow[]).map((k) => (
                        <tr key={k.keyword} className="border-t border-neutral-100">
                          <td className="px-2 py-1.5 text-neutral-700">{k.keyword}</td>
                          <td className="px-2 py-1.5 text-right text-neutral-500">
                            {k.searchVolume != null ? k.searchVolume.toLocaleString("es-MX") : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {k.ownUrl ? (
                              <a
                                href={k.ownUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#228449] font-medium hover:underline"
                              >
                                #{k.ownPosition}
                              </a>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {k.competitorUrl ? (
                              <a
                                href={k.competitorUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-neutral-700 font-medium hover:underline"
                              >
                                #{k.competitorPosition}
                              </a>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-[13px] font-medium text-neutral-700">
            Tareas para ganarle keywords a {nextCompetitor.domain}
            {beatTasks.length > 0 && (
              <span className="text-neutral-400 font-normal"> ({checkedTasks.size}/{beatTasks.length} hechas)</span>
            )}
          </p>
          {beatTasks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportBeatTasksCsv(beatTasks, nextCompetitor.domain, checkedTasks)}
                className="text-[11px] bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 rounded-md px-2 py-1 transition-colors"
              >
                Exportar CSV
              </button>
              <button
                onClick={() => exportBeatTasksExcel(beatTasks, nextCompetitor.domain, checkedTasks)}
                className="text-[11px] bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 rounded-md px-2 py-1 transition-colors"
              >
                Exportar Excel
              </button>
              <button
                onClick={() => exportBeatTasksPdf(beatTasks, nextCompetitor.domain, checkedTasks)}
                className="text-[11px] bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 rounded-md px-2 py-1 transition-colors"
              >
                Exportar PDF
              </button>
            </div>
          )}
        </div>
        {!nextCompetitor.rankedKeywordsJson ? (
          <p className="text-xs text-neutral-400">
            Todavia no tenemos las keywords posicionadas de {nextCompetitor.domain} — ve a su
            tarjeta de competidor mas abajo y dale &quot;Actualizar&quot; para generar esta lista.
          </p>
        ) : beatTasks.length === 0 ? (
          <p className="text-xs text-neutral-400">
            No encontramos oportunidades claras en sus keywords top — probablemente ya vas parejo
            o mejor que {nextCompetitor.domain} en las keywords que mas le importan.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {beatTasks.map((t) => {
              const done = checkedTasks.has(t.keyword);
              return (
                <li key={t.keyword}>
                  <label
                    className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      done ? "bg-neutral-50 border-neutral-200" : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleTaskChecked(t.keyword)}
                      className="mt-0.5 w-3.5 h-3.5 accent-[#228449] cursor-pointer shrink-0"
                    />
                    <span className={done ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-700"}>
                      {t.ownPosition == null ? (
                        <>
                          Crea o mejora contenido para <strong>&quot;{t.keyword}&quot;</strong>
                          {t.searchVolume ? ` (${t.searchVolume.toLocaleString("es-MX")} busquedas/mes)` : ""} — {nextCompetitor.domain} esta en el puesto{" "}
                          <strong>#{t.competitorPosition}</strong> y tu no apareces en el top 100.
                        </>
                      ) : (
                        <>
                          Mejora tu posicion en <strong>&quot;{t.keyword}&quot;</strong>
                          {t.searchVolume ? ` (${t.searchVolume.toLocaleString("es-MX")} busquedas/mes)` : ""} — estas en el puesto{" "}
                          <strong>#{t.ownPosition}</strong>, {nextCompetitor.domain} esta en el{" "}
                          <strong>#{t.competitorPosition}</strong>.
                        </>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    )}
    </>
  );
}

interface CompetitorSuggestionRow {
  domain: string;
  commonKeywords: number;
  organicKeywords: number | null;
  organicTrafficEstimate: number | null;
}

interface IntersectionKeywordRow {
  keyword: string;
  searchVolume: number | null;
  ownPosition: number | null;
  ownUrl: string | null;
  competitorPosition: number | null;
  competitorUrl: string | null;
}

const CompetitorDiscoverySection = forwardRef(function CompetitorDiscoverySection(
  { projectId, onLoadingChange }: { projectId: string; onLoadingChange?: (loading: boolean) => void },
  ref: React.Ref<{ detect: () => void }>
) {
  const router = useRouter();
  const [loading, setLoadingState] = useState(false);
  function setLoading(v: boolean) {
    setLoadingState(v);
    onLoadingChange?.(v);
  }
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CompetitorSuggestionRow[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<{ done: number; total: number } | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [intersectionByDomain, setIntersectionByDomain] = useState<
    Record<string, IntersectionKeywordRow[] | "loading" | "error">
  >({});

  async function toggleIntersection(domain: string) {
    if (expandedDomain === domain) {
      setExpandedDomain(null);
      return;
    }
    setExpandedDomain(domain);
    if (intersectionByDomain[domain]) return;
    setIntersectionByDomain((prev) => ({ ...prev, [domain]: "loading" }));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/competitors/intersection?domain=${encodeURIComponent(domain)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setIntersectionByDomain((prev) => ({ ...prev, [domain]: data.keywords ?? [] }));
    } catch {
      setIntersectionByDomain((prev) => ({ ...prev, [domain]: "error" }));
    }
  }

  async function handleDetect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/competitors/discover`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al detectar competidores");
      setSuggestions(data.suggestions ?? []);
      setChecked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al detectar competidores");
    } finally {
      setLoading(false);
    }
  }

  function toggle(domain: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function handleAddSelected() {
    if (checked.size === 0) return;
    setAdding(true);
    const domains = Array.from(checked);
    setAddProgress({ done: 0, total: domains.length });
    for (const domain of domains) {
      try {
        await fetch(`/api/projects/${projectId}/competitors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        });
      } catch {
        // best-effort — keep going with the rest
      }
      setAddProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }
    setAdding(false);
    setAddProgress(null);
    setSuggestions(null);
    setChecked(new Set());
    router.refresh();
  }

  useImperativeHandle(ref, () => ({ detect: handleDetect }));

  if (suggestions === null && !loading && !error) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Detectar competidores</p>
          <p className="text-neutral-500 text-xs mt-0.5">
            Buscamos hasta 20 dominios que compiten por las mismas palabras
            clave que tu, para que elijas cuales agregar al rastreo.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {suggestions && suggestions.length === 0 && !error && (
        <p className="text-xs text-neutral-400">
          No encontramos mas competidores sugeridos (o ya los tienes todos agregados).
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-200">
                  <th className="text-left font-normal px-2 py-1.5 w-8">
                    <input
                      type="checkbox"
                      checked={checked.size === suggestions.length}
                      onChange={() =>
                        setChecked((prev) =>
                          prev.size === suggestions.length
                            ? new Set()
                            : new Set(suggestions.map((s) => s.domain))
                        )
                      }
                      className="w-3.5 h-3.5 accent-[#228449] cursor-pointer"
                    />
                  </th>
                  <th className="text-left font-normal px-2 py-1.5">Dominio</th>
                  <th className="text-right font-normal px-2 py-1.5">Keywords en comun</th>
                  <th className="text-right font-normal px-2 py-1.5">Keywords organicas</th>
                  <th className="text-right font-normal px-2 py-1.5">Trafico organico est.</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const intersection = intersectionByDomain[s.domain];
                  return (
                  <Fragment key={s.domain}>
                  <tr
                    className="cursor-pointer hover:bg-neutral-50 transition-colors"
                    onClick={() => toggle(s.domain)}
                  >
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked.has(s.domain)}
                        onChange={() => toggle(s.domain)}
                        className="w-3.5 h-3.5 accent-[#228449] cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-neutral-700">
                      <span className="inline-flex items-center gap-1.5">
                        {s.domain}
                        <a
                          href={`https://${s.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`Abrir ${s.domain}`}
                          className="text-neutral-400 hover:text-[#228449] transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <path d="M15 3h6v6M10 14 21 3" />
                          </svg>
                        </a>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleIntersection(s.domain);
                        }}
                        className="text-neutral-600 hover:text-[#228449] hover:underline underline-offset-2 transition-colors"
                        title="Ver las keywords en comun y su posicionamiento"
                      >
                        {s.commonKeywords.toLocaleString("es-MX")}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-500">
                      {s.organicKeywords != null ? s.organicKeywords.toLocaleString("es-MX") : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-400">
                      {s.organicTrafficEstimate != null
                        ? `${s.organicTrafficEstimate.toLocaleString("es-MX")}/mes`
                        : "—"}
                    </td>
                  </tr>
                  {expandedDomain === s.domain && (
                    <tr>
                      <td colSpan={5} className="bg-neutral-50 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {intersection === "loading" && (
                          <p className="text-neutral-400 text-xs">Cargando keywords en comun...</p>
                        )}
                        {intersection === "error" && (
                          <p className="text-red-600 text-xs">Error al cargar las keywords en comun.</p>
                        )}
                        {Array.isArray(intersection) && intersection.length === 0 && (
                          <p className="text-neutral-400 text-xs">No encontramos keywords en comun.</p>
                        )}
                        {Array.isArray(intersection) && intersection.length > 0 && (
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-neutral-400 border-b border-neutral-200">
                                  <th className="text-left font-normal px-2 py-1">Keyword</th>
                                  <th className="text-right font-normal px-2 py-1">Volumen</th>
                                  <th className="text-right font-normal px-2 py-1">Tu posicion</th>
                                  <th className="text-right font-normal px-2 py-1">Posicion de {s.domain}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {intersection.map((k) => (
                                  <tr key={k.keyword} className="border-t border-neutral-100">
                                    <td className="px-2 py-1 text-neutral-700">{k.keyword}</td>
                                    <td className="px-2 py-1 text-right text-neutral-500">
                                      {k.searchVolume != null ? k.searchVolume.toLocaleString("es-MX") : "—"}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      {k.ownUrl ? (
                                        <a
                                          href={k.ownUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[#228449] font-medium hover:underline"
                                        >
                                          #{k.ownPosition}
                                        </a>
                                      ) : (
                                        <span className="text-neutral-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      {k.competitorUrl ? (
                                        <a
                                          href={k.competitorUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-neutral-700 font-medium hover:underline"
                                        >
                                          #{k.competitorPosition}
                                        </a>
                                      ) : (
                                        <span className="text-neutral-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleAddSelected}
            disabled={checked.size === 0 || adding}
            className="self-start text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3.5 py-2 transition-colors whitespace-nowrap"
          >
            {adding
              ? `Agregando ${addProgress?.done ?? 0}/${addProgress?.total ?? 0}...`
              : `Agregar ${checked.size} seleccionado${checked.size === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
});

interface GapPositionCell {
  position: number | null;
  url: string | null;
}

function GapPositionLink({ cell, own }: { cell: GapPositionCell; own?: boolean }) {
  if (cell.position == null) return <span className="text-neutral-300">—</span>;
  const label = `#${cell.position}`;
  const className = own
    ? "font-medium text-[#228449] hover:underline"
    : "text-neutral-600 hover:text-[#228449] hover:underline";
  if (!cell.url) return <span className={own ? "font-medium text-[#228449]" : "text-neutral-600"}>{label}</span>;
  return (
    <a href={cell.url} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}

function KeywordGapSection({ project }: { project: ProjectDTO }) {
  const [sortBy, setSortBy] = useState<string>("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "keyword" ? "asc" : col === "volume" ? "desc" : "asc");
    }
  }

  const competitorsWithKeywords = project.competitors.filter((c) => c.rankedKeywordsJson);
  if (competitorsWithKeywords.length === 0) return null;

  // Prefer our own real rank-tracking data (live, precise) when the
  // keyword happens to be one we actively track; otherwise fall back to
  // DataForSEO's ranked-keywords estimate for our own domain (same source
  // used for competitors, refreshed via "Analizar mi dominio" in
  // Competencia) so the "Tu" column isn't empty just because we never
  // manually added that exact keyword.
  const ownRanked: { keyword: string; position: number | null; url: string | null }[] =
    project.domainRankedKeywordsJson ? JSON.parse(project.domainRankedKeywordsJson) : [];
  const ownRankedMap = new Map(ownRanked.map((r) => [r.keyword.toLowerCase(), r]));

  function ownPositionFor(keywordText: string): GapPositionCell {
    const key = keywordText.toLowerCase();
    const kw = project.keywords.find((k) => k.text.toLowerCase() === key);
    if (kw) {
      let latest: KeywordDTO["rankings"][number] | null = null;
      for (const r of kw.rankings) {
        if (r.domain !== project.domain || r.position == null) continue;
        if (!latest || new Date(r.checkedAt) > new Date(latest.checkedAt)) latest = r;
      }
      if (latest?.position != null) return { position: latest.position, url: latest.url };
    }
    const est = ownRankedMap.get(key);
    return est ? { position: est.position, url: est.url } : { position: null, url: null };
  }

  type GapRow = { volume: number | null; own: GapPositionCell; positions: Record<string, GapPositionCell> };
  const rows = new Map<string, GapRow>();

  for (const kw of project.keywords) {
    const key = kw.text.toLowerCase();
    if (!rows.has(key)) {
      rows.set(key, { volume: null, own: ownPositionFor(kw.text), positions: {} });
    }
  }

  for (const c of competitorsWithKeywords) {
    const ranked: { keyword: string; position: number | null; searchVolume: number | null; url: string | null }[] =
      JSON.parse(c.rankedKeywordsJson!);
    for (const r of ranked) {
      if (!r.keyword) continue;
      const key = r.keyword.toLowerCase();
      const existing = rows.get(key) ?? {
        volume: null,
        own: ownPositionFor(r.keyword),
        positions: {},
      };
      if (existing.volume == null) existing.volume = r.searchVolume;
      existing.positions[c.domain] = { position: r.position, url: r.url ?? null };
      rows.set(key, existing);
    }
  }

  // Solo keywords realmente compartidas: donde tu tienes posicion Y al
  // menos un competidor tambien — no todo lo que rastreas o que le
  // detectamos a cada quien por separado.
  const sortedRows = Array.from(rows.entries())
    .map(([keyword, data]) => ({ keyword, ...data }))
    .filter(
      (row) =>
        row.own.position != null &&
        Object.values(row.positions).some((p) => p.position != null)
    )
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "keyword") return a.keyword.localeCompare(b.keyword) * dir;
      if (sortBy === "volume") {
        const va = a.volume;
        const vb = b.volume;
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (va - vb) * dir;
      }
      const va = sortBy === "own" ? a.own.position : a.positions[sortBy]?.position ?? null;
      const vb = sortBy === "own" ? b.own.position : b.positions[sortBy]?.position ?? null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    });

  const competitorDomains = competitorsWithKeywords.map((c) => c.domain);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900 mb-0.5">Comparativa de keywords</p>
      <p className="text-neutral-400 text-[14px] mb-3">
        Solo keywords donde tu y al menos un competidor coinciden (hasta 20
        de muestra por competidor, no su catalogo completo), con la
        posicion de cada quien lado a lado. Dale clic a una posicion para
        abrir la URL que esta posicionada.
      </p>
      {sortedRows.length === 0 ? (
        <p className="text-xs text-neutral-400">
          No encontramos keywords compartidas entre tu dominio y estos
          competidores todavia.
        </p>
      ) : (
      <div className="overflow-x-auto">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-50">
              <tr className="text-neutral-400 border-b border-neutral-200">
                <th className="text-left px-2 py-1.5 font-normal bg-neutral-50">
                  <SortHeader
                    label="Keyword"
                    active={sortBy === "keyword"}
                    dir={sortDir}
                    onClick={() => toggleSort("keyword")}
                  />
                </th>
                <th className="text-right px-2 py-1.5 font-normal bg-neutral-50">
                  <span className="inline-flex justify-end w-full">
                    <SortHeader
                      label="Volumen"
                      active={sortBy === "volume"}
                      dir={sortDir}
                      onClick={() => toggleSort("volume")}
                    />
                  </span>
                </th>
                <th className="text-right px-2 py-1.5 font-normal text-[#228449] bg-neutral-50 whitespace-nowrap">
                  <span className="inline-flex justify-end w-full">
                    <SortHeader
                      label="Tu"
                      active={sortBy === "own"}
                      dir={sortDir}
                      onClick={() => toggleSort("own")}
                    />
                  </span>
                </th>
                {competitorDomains.map((d) => (
                  <th key={d} className="text-right px-2 py-1.5 font-normal bg-neutral-50 whitespace-nowrap">
                    <span className="inline-flex justify-end w-full">
                      <SortHeader
                        label={d}
                        active={sortBy === d}
                        dir={sortDir}
                        onClick={() => toggleSort(d)}
                      />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.keyword} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-2 py-1.5 text-neutral-700 whitespace-nowrap">{row.keyword}</td>
                  <td className="px-2 py-1.5 text-right text-neutral-400 whitespace-nowrap">
                    {row.volume != null ? `${row.volume.toLocaleString("es-MX")}/mes` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <GapPositionLink cell={row.own} own />
                  </td>
                  {competitorDomains.map((d) => (
                    <td key={d} className="px-2 py-1.5 text-right">
                      <GapPositionLink cell={row.positions[d] ?? { position: null, url: null }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

function CompetitorsSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const discoveryRef = useRef<{ detect: () => void }>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      setDomain("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CompetitorComparisonOverview
        project={project}
        detectButton={
          <button
            onClick={() => discoveryRef.current?.detect()}
            disabled={detecting}
            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {detecting ? "Buscando..." : "Detectar competidores"}
          </button>
        }
      />

      <CompetitorDiscoverySection ref={discoveryRef} projectId={project.id} onLoadingChange={setDetecting} />

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(normalizeDomain(e.target.value))}
          placeholder="competidor.com o su tienda Shopify"
          className="flex-1 bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        />
        <button
          type="submit"
          disabled={saving || !domain}
          className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 transition-colors"
        >
          {saving ? "Agregando..." : "Agregar"}
        </button>
      </form>

      <p className="text-[14px] text-neutral-400">
        El trafico es un estimado (como el de SEMrush/Ahrefs), no un dato
        real — nadie fuera del dueño del sitio puede ver trafico o ventas
        reales de otra tienda. Si el dominio es una tienda Shopify,
        detectamos su catalogo publico automaticamente.
      </p>

      {project.competitors.length === 0 ? (
        <p className="text-neutral-400 text-sm">Sin competidores agregados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {project.competitors.map((c) => (
            <CompetitorCard key={c.id} competitor={c} />
          ))}
        </div>
      )}

      <KeywordGapSection project={project} />
    </div>
  );
}

function AddKeywordForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [engine, setEngine] = useState("google");
  const [device, setDevice] = useState("desktop");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, engine, device }),
      });
      if (res.ok) {
        setText("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 bg-white border border-neutral-200 rounded-xl p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-[14px] text-neutral-500">Keyword</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ej. mobiliario para hoteles"
          required
          className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[14px] text-neutral-500">Motor</label>
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
          >
            <option value="google">Google</option>
            <option value="bing">Bing</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[14px] text-neutral-500">Dispositivo</label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
          >
            <option value="desktop">Escritorio</option>
            <option value="mobile">Móvil</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
        >
          {saving ? "Agregando..." : "Agregar"}
        </button>

        <p className="text-[14px] text-neutral-400 ml-auto self-center">
          ¿ChatGPT o Perplexity? Agrega esas keywords desde SEO IA.
        </p>
      </div>
    </form>
  );
}

interface AppSearchResult {
  appId: string;
  title: string;
  icon: string | null;
  developer: string | null;
  rating: number | null;
  reviewsCount: number | null;
  isFree: boolean | null;
  price: number | null;
  currency: string | null;
  url: string | null;
}

function AppResultRow({
  app,
  isMine,
  onSelect,
  selecting,
}: {
  app: AppSearchResult;
  isMine: boolean;
  onSelect: () => void;
  selecting: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-neutral-200">
      {app.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={app.icon} alt="" className="w-9 h-9 rounded-lg shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-neutral-100 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <a
          href={app.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-900 truncate hover:text-[#228449] hover:underline block"
        >
          {app.title}
        </a>
        <p className="text-[14px] text-neutral-400 truncate">
          {app.developer ? `${app.developer} · ` : ""}
          {app.rating != null ? `★ ${app.rating.toFixed(1)}` : "Sin calificacion"}
          {app.reviewsCount != null ? ` (${app.reviewsCount.toLocaleString("es-MX")})` : ""}
          {app.isFree === false && app.price != null
            ? ` · ${app.currency ?? ""}${app.price}`
            : app.isFree
            ? " · Gratis"
            : ""}
        </p>
      </div>
      {isMine ? (
        <span className="text-[14px] bg-emerald-50 text-emerald-700 rounded-md px-2.5 py-1 shrink-0">
          Tu app
        </span>
      ) : (
        <button
          onClick={onSelect}
          disabled={selecting}
          className="text-[14px] bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 rounded-md px-2.5 py-1 shrink-0 transition-colors whitespace-nowrap"
        >
          {selecting ? "..." : "Es mi app"}
        </button>
      )}
    </div>
  );
}

// Built and working, but the tab shows a "Proximamente" placeholder for now
// (see activeTab === "apps" above) until it's ready to launch.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AppsSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [query, setQuery] = useState(project.appQuery ?? project.name);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cached: { google?: AppSearchResult[]; apple?: AppSearchResult[] } =
    project.appsResultsJson ? JSON.parse(project.appsResultsJson) : {};
  const googleResults = cached.google ?? [];
  const appleResults = cached.apple ?? [];
  const hasResults = project.appsCheckedAt != null;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/apps/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar apps");
      if (data.errors?.length) setError(data.errors.join(" · "));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar apps");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(platform: "google" | "apple", appId: string) {
    setSelectingId(appId);
    try {
      await fetch(`/api/projects/${project.id}/apps/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, appId }),
      });
      router.refresh();
    } finally {
      setSelectingId(null);
    }
  }

  const hasMineData = project.googlePlayAppId || project.appleAppId;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <p className="text-sm font-medium text-neutral-900">Apps iOS y Android</p>
        <p className="text-neutral-500 text-xs mt-0.5 mb-3">
          Busca tu app (o la de tus competidores) en Google Play y la App
          Store: calificacion, numero de reseñas y precio.
        </p>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-[14px] text-neutral-500">Nombre de la app o marca</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={project.name}
              className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query}
            className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
          >
            {loading ? "Buscando..." : "Buscar apps"}
          </button>
        </form>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <p className="text-[14px] text-neutral-400 mt-2">
          La busqueda de apps puede tardar hasta medio minuto — DataForSEO
          procesa esta consulta como una tarea, no es instantanea.
        </p>
      </div>

      {hasMineData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {project.googlePlayAppRating != null && (
            <StatCard label="Google Play — calificacion" value={project.googlePlayAppRating.toFixed(1)} />
          )}
          {project.googlePlayAppReviews != null && (
            <StatCard label="Google Play — reseñas" value={project.googlePlayAppReviews.toLocaleString("es-MX")} />
          )}
          {project.appleAppRating != null && (
            <StatCard label="App Store — calificacion" value={project.appleAppRating.toFixed(1)} />
          )}
          {project.appleAppReviews != null && (
            <StatCard label="App Store — reseñas" value={project.appleAppReviews.toLocaleString("es-MX")} />
          )}
        </div>
      )}

      {hasResults && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
              Google Play
            </h2>
            {googleResults.length === 0 ? (
              <p className="text-xs text-neutral-400">Sin resultados.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {googleResults.map((app) => (
                  <AppResultRow
                    key={app.appId}
                    app={app}
                    isMine={project.googlePlayAppId === app.appId}
                    selecting={selectingId === app.appId}
                    onSelect={() => handleSelect("google", app.appId)}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
              App Store
            </h2>
            {appleResults.length === 0 ? (
              <p className="text-xs text-neutral-400">Sin resultados.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {appleResults.map((app) => (
                  <AppResultRow
                    key={app.appId}
                    app={app}
                    isMine={project.appleAppId === app.appId}
                    selecting={selectingId === app.appId}
                    onSelect={() => handleSelect("apple", app.appId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
