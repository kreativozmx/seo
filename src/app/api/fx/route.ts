import { NextRequest, NextResponse } from "next/server";

// Frankfurter (ECB reference rates): free, keyless. Only ECB-tracked
// currencies exist (MXN, BRL, EUR, GBP, CAD...); others (ARS, COP, CLP, PEN...)
// come back with rate null and the UI keeps showing USD.
const cache = new Map<string, { at: number; rate: number | null; date: string | null }>();
const TTL = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const to = (req.nextUrl.searchParams.get("to") ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(to)) return NextResponse.json({ error: "Moneda invalida" }, { status: 400 });
  if (to === "USD") return NextResponse.json({ currency: "USD", rate: 1, date: null });

  const hit = cache.get(to);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ currency: to, rate: hit.rate, date: hit.date });

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${to}`, {
      signal: AbortSignal.timeout(6000),
    });
    const json = res.ok ? await res.json() : null;
    const rate: number | null = json?.rates?.[to] ?? null;
    const date: string | null = json?.date ?? null;
    cache.set(to, { at: Date.now(), rate, date });
    return NextResponse.json({ currency: to, rate, date });
  } catch {
    return NextResponse.json({ currency: to, rate: null, date: null });
  }
}
