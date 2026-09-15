import { NextRequest, NextResponse } from "next/server";

// Single hardcoded admin login (no signup) gating the whole app. Stays open
// for: the login page itself, per-project public share links (/share/...
// — the whole point is no-login access for clients), the two legal pages
// (Google/Shopify review fetch these directly), the changelog list API
// (public Shopify content, also read by the share view), and Vercel Cron
// requests (authenticated separately via CRON_SECRET, never carry a
// browser cookie).
const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/legal/privacidad",
  "/legal/terminos",
  "/api/changelog",
  "/share/",
  "/api/cron/",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.AUTH_SESSION_TOKEN;
  const session = req.cookies.get("session")?.value;

  if (expected && session === expected) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
