import { cookies } from "next/headers";
import { TopBar } from "@/components/TopBar";
import { ChangelogSection } from "@/components/dashboard/ChangelogSection";
import { LOCALE_COOKIE, translate } from "@/lib/i18n/dictionaries";

export const metadata = { title: "Actualizaciones Shopify — Shopify Audit" };

export default function ShopifyUpdatesPage() {
  const locale = cookies().get(LOCALE_COOKIE)?.value === "en" ? "en" : "es";
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <TopBar>
        <a
          href="/api/logout"
          className="text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          {translate(locale, "chrome.logout")}
        </a>
      </TopBar>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <ChangelogSection />
      </main>
    </div>
  );
}
