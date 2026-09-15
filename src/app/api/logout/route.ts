import { NextRequest, NextResponse } from "next/server";

function clearAndRedirect(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

// GET so a plain <a href="/api/logout"> link works with no client JS.
export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}
