import { NextRequest, NextResponse } from "next/server";
import { getSuggestions } from "@/lib/providers/suggest";

export const maxDuration = 30;

// GET /api/suggest?q=&hl=es&gl=mx&source=google|youtube&expand=1
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 120);
  if (!q) return NextResponse.json({ suggestions: [] });
  const suggestions = await getSuggestions({
    q,
    source: sp.get("source") === "youtube" ? "youtube" : "google",
    hl: (sp.get("hl") ?? "es").slice(0, 5),
    gl: (sp.get("gl") ?? "mx").slice(0, 2),
    expand: sp.get("expand") === "1",
  });
  return NextResponse.json({ suggestions });
}
