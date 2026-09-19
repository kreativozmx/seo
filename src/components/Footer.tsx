import Link from "next/link";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, Locale, translate } from "@/lib/i18n/dictionaries";

export default function Footer() {
  const loggedIn = Boolean(cookies().get("session")?.value);
  const locale: Locale = cookies().get(LOCALE_COOKIE)?.value === "en" ? "en" : "es";

  return (
    <footer className="border-t border-neutral-100 mt-auto">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
        <p>&copy; {new Date().getFullYear()} Shopify Audit</p>
        <nav className="flex items-center gap-4">
          <Link href="/legal/privacidad" className="hover:text-neutral-600">
            {translate(locale, "footer.privacy")}
          </Link>
          <Link href="/legal/terminos" className="hover:text-neutral-600">
            {translate(locale, "footer.terms")}
          </Link>
          {loggedIn && (
            <a href="/api/logout" className="hover:text-neutral-600">
              {translate(locale, "chrome.logout")}
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
