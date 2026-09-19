"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface TopBarLink {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  newTab?: boolean;
}

// Global light top bar (logo + tool links, Ahrefs-style). Used by the project
// dashboard, the project list and the standalone tool pages, so the same
// links are reachable everywhere. Pages that live inside a stateful view (the
// dashboard) can pass their own `links` with onClick handlers instead of hrefs.
export function TopBar({
  links,
  sticky = false,
  children,
}: {
  links?: TopBarLink[];
  sticky?: boolean;
  children?: React.ReactNode; // right-hand side (sync pill, logout, ...)
}) {
  const { t } = useLocale();
  const pathname = usePathname();

  const items: TopBarLink[] = links ?? [
    { key: "projects", label: t("nav.projects"), href: "/", active: pathname === "/" },
    { key: "changelog", label: t("nav.changelog"), href: "/actualizaciones", active: pathname === "/actualizaciones" },
    { key: "domain", label: t("whois.button"), href: "/dominio", active: pathname === "/dominio" },
  ];

  const base =
    "h-12 flex items-center px-3 text-[13px] whitespace-nowrap border-b-2 transition-colors shrink-0";
  const style = (active?: boolean) =>
    `${base} ${
      active
        ? "border-[#228449] text-neutral-900 font-semibold"
        : "border-transparent text-neutral-500 hover:text-neutral-900"
    }`;

  return (
    <div
      className={`h-12 shrink-0 bg-white border-b border-neutral-200 flex items-center justify-between px-3 sm:px-4 gap-3 ${
        sticky ? "sticky top-0 z-30" : ""
      }`}
    >
      <div className="flex items-center min-w-0 self-stretch">
        <Link href="/" className="flex items-center gap-2 mr-3 sm:mr-5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={30} className="shrink-0" />
          <span className="text-neutral-900 text-sm font-semibold tracking-tight hidden sm:inline">Shopify Audit</span>
          <span
            title={t("beta.tooltip")}
            className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 leading-none"
          >
            Beta
          </span>
        </Link>
        <nav className="flex items-stretch overflow-x-auto">
          {items.map((l) =>
            l.href ? (
              <a
                key={l.key}
                href={l.href}
                target={l.newTab ? "_blank" : undefined}
                rel={l.newTab ? "noopener" : undefined}
                className={style(l.active)}
              >
                {l.label}
              </a>
            ) : (
              <button key={l.key} onClick={l.onClick} className={style(l.active)}>
                {l.label}
              </button>
            )
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3 min-w-0 shrink-0">{children}</div>
    </div>
  );
}
