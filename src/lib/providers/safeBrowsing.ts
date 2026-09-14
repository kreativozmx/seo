// Google Safe Browsing API (Lookup v4) — free, API-key only. Flags whether
// a domain is currently listed as malware/phishing/unwanted software.
// Docs: https://developers.google.com/safe-browsing/v4/lookup-api

const BASE_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

export interface SafeBrowsingResult {
  clean: boolean;
  threats: string[];
}

export async function checkSafeBrowsing(
  domain: string
): Promise<SafeBrowsingResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY no esta configurada");
  }

  const res = await fetch(`${BASE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: { clientId: "seo-rank-tracker", clientVersion: "1.0.0" },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [
          { url: `https://${domain}/` },
          { url: `http://${domain}/` },
        ],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Safe Browsing request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const matches: { threatType?: string }[] = json?.matches ?? [];
  const threats = Array.from(
    new Set(matches.map((m) => m.threatType).filter(Boolean) as string[])
  );

  return { clean: threats.length === 0, threats };
}
