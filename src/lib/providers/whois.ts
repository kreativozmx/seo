import net from "net";

// Public domain-ownership lookup for ANY domain (not only the project's).
// Order: RDAP (the modern, structured WHOIS successor; via rdap.org, which
// redirects to the right registry) -> classic WHOIS on port 43 for TLDs
// that have no RDAP (e.g. .mx) -> DNS (Cloudflare DNS-over-HTTPS) always,
// for a hosting hint. Since GDPR most gTLD registrants are redacted, so
// "who owns it" is often just the registrar; ccTLDs like .mx still show it.
export interface DomainLookup {
  domain: string;
  source: "rdap" | "whois" | "none";
  registrar: string | null;
  registrant: { name: string | null; org: string | null; country: string | null; redacted: boolean } | null;
  created: string | null;
  expires: string | null;
  updated: string | null;
  daysToExpire: number | null;
  statuses: string[];
  nameservers: string[];
  dnssec: boolean | null;
  dns: { a: string[]; ns: string[]; mx: string[] };
  hostingHint: string | null;
  rawWhois: string | null;
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
export function isValidDomain(d: string) {
  return HOSTNAME_RE.test(d);
}

async function fetchJson(url: string, headers: Record<string, string> = {}, timeoutMs = 8000) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "ShopifyAudit/1.0 (+https://shopifyaudit.com)", ...headers }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function whoisQuery(server: string, query: string, timeoutMs = 9000): Promise<string | null> {
  return new Promise((resolve) => {
    if (!HOSTNAME_RE.test(server)) return resolve(null);
    let data = "";
    const socket = net.connect({ host: server, port: 43 });
    const done = (v: string | null) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs, () => done(data || null));
    socket.on("connect", () => socket.write(`${query}\r\n`));
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
      if (data.length > 60_000) done(data);
    });
    socket.on("end", () => done(data || null));
    socket.on("error", () => done(null));
  });
}

async function findWhoisServer(tld: string): Promise<string | null> {
  const res = await whoisQuery("whois.iana.org", tld);
  const m = res?.match(/^\s*(?:whois|refer):\s*(\S+)/im);
  return m ? m[1].toLowerCase() : null;
}

function vcardValue(entity: { vcardArray?: unknown[] }, field: string): string | null {
  const props = (entity.vcardArray?.[1] as unknown[][] | undefined) ?? [];
  const hit = props.find((p) => p[0] === field);
  const v = hit?.[3];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function vcardCountry(entity: { vcardArray?: unknown[] }): string | null {
  const props = (entity.vcardArray?.[1] as unknown[][] | undefined) ?? [];
  const adr = props.find((p) => p[0] === "adr");
  const parts = adr?.[3];
  const last = Array.isArray(parts) ? (parts[6] as string) : null;
  return last || null;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown[];
  entities?: RdapEntity[];
}

function parseRdap(json: Record<string, unknown>): Partial<DomainLookup> {
  const events = (json.events as { eventAction: string; eventDate: string }[] | undefined) ?? [];
  const ev = (name: string) => events.find((e) => e.eventAction.toLowerCase() === name)?.eventDate ?? null;
  const entities = (json.entities as RdapEntity[] | undefined) ?? [];
  const registrarEnt = entities.find((e) => e.roles?.includes("registrar"));
  const registrantEnt = entities.find((e) => e.roles?.includes("registrant"));

  const name = registrantEnt ? vcardValue(registrantEnt, "fn") : null;
  const org = registrantEnt ? vcardValue(registrantEnt, "org") : null;
  const redactedText = /redact|privacy|withheld|not disclosed|proxy/i;
  const redacted = !registrantEnt || (!name && !org) || redactedText.test(`${name ?? ""} ${org ?? ""}`);

  return {
    registrar: registrarEnt ? vcardValue(registrarEnt, "fn") : null,
    registrant: { name: redacted ? null : name, org: redacted ? null : org, country: registrantEnt ? vcardCountry(registrantEnt) : null, redacted },
    created: ev("registration"),
    expires: ev("expiration"),
    updated: ev("last changed"),
    statuses: (json.status as string[] | undefined) ?? [],
    nameservers: ((json.nameservers as { ldhName: string }[] | undefined) ?? []).map((n) => n.ldhName.toLowerCase()),
    dnssec: (json.secureDNS as { delegationSigned?: boolean } | undefined)?.delegationSigned ?? null,
  };
}

function parseWhoisText(text: string): Partial<DomainLookup> {
  const clean = text.replace(/\r/g, "");
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const m = clean.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, "im"));
      if (m && m[1].trim()) return m[1].trim();
    }
    return null;
  };
  const toIso = (v: string | null) => {
    if (!v) return null;
    const d = new Date(v.replace(/\s+/g, " "));
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  };
  // Registrant block (.mx style): "Registrant:" followed by indented Name/City/Country lines.
  const block = clean.match(/^\s*Registrant\s*:?\s*\n((?:[ \t]+.+\n?)+)/im)?.[1] ?? "";
  const inBlock = (k: string) => block.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, "im"))?.[1]?.trim() ?? null;
  const name = inBlock("Name") ?? first("Registrant Name");
  const org = inBlock("Organization") ?? first("Registrant Organization", "Registrant Organisation");
  const country = inBlock("Country") ?? first("Registrant Country");
  const redacted = !name && !org;

  const ns = Array.from(clean.matchAll(/^\s*(?:DNS|Name ?Servers?)\s*:\s*([a-z0-9.-]+)\s*$/gim), (m) => m[1].toLowerCase());

  return {
    registrar: first("Registrar"),
    registrant: { name, org, country, redacted },
    created: toIso(first("Created On", "Creation Date", "Created", "Registered on")),
    expires: toIso(first("Expiration Date", "Registry Expiry Date", "Expires On", "Expiry date")),
    updated: toIso(first("Last Updated On", "Updated Date", "Last Modified")),
    statuses: Array.from(clean.matchAll(/^\s*(?:Domain )?Status\s*:\s*(\S.*)$/gim), (m) => m[1].trim()),
    nameservers: Array.from(new Set(ns)),
    dnssec: null,
  };
}

async function dnsLookup(domain: string): Promise<DomainLookup["dns"]> {
  const q = async (type: string) => {
    const j = await fetchJson(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
      { accept: "application/dns-json" },
      6000
    );
    return ((j?.Answer as { data: string }[] | undefined) ?? []).map((a) => a.data.replace(/\.$/, ""));
  };
  const [a, ns, mx] = await Promise.all([q("A"), q("NS"), q("MX")]);
  return { a, ns, mx: mx.map((m) => m.replace(/^\d+\s+/, "")) };
}

function hostingHint(dns: DomainLookup["dns"]): string | null {
  if (dns.a.some((ip) => ip.startsWith("23.227.38."))) return "Shopify";
  if (dns.a.some((ip) => /^(104\.(1[6-9]|2\d|3[01])|172\.6[4-7]|188\.114|141\.101|108\.162)\./.test(ip))) return "Cloudflare";
  if (dns.a.some((ip) => ip.startsWith("76.76.21.") || ip.startsWith("76.76.19."))) return "Vercel";
  return null;
}

export async function lookupDomain(input: string): Promise<DomainLookup> {
  const domain = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!isValidDomain(domain)) throw new Error("Dominio invalido");

  const [dns, rdapJson] = await Promise.all([
    dnsLookup(domain),
    fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { accept: "application/rdap+json" }),
  ]);

  let parsed: Partial<DomainLookup> = {};
  let source: DomainLookup["source"] = "none";
  let rawWhois: string | null = null;

  if (rdapJson && !rdapJson.errorCode) {
    parsed = parseRdap(rdapJson);
    source = "rdap";
  } else {
    const tld = domain.split(".").pop() as string;
    const server = await findWhoisServer(tld);
    const text = server ? await whoisQuery(server, domain) : null;
    if (text && !/no match|not found|no entries found/i.test(text.slice(0, 400))) {
      parsed = parseWhoisText(text);
      source = "whois";
      rawWhois = text
        .split("\n")
        .filter((l) => !l.trim().startsWith("%") && !l.trim().startsWith("#"))
        .join("\n")
        .trim()
        .slice(0, 6000);
    }
  }

  const expires = parsed.expires ?? null;
  return {
    domain,
    source,
    registrar: parsed.registrar ?? null,
    registrant: parsed.registrant ?? null,
    created: parsed.created ?? null,
    expires,
    updated: parsed.updated ?? null,
    daysToExpire: expires ? Math.floor((new Date(expires).getTime() - Date.now()) / 86_400_000) : null,
    statuses: parsed.statuses ?? [],
    nameservers: parsed.nameservers?.length ? parsed.nameservers : dns.ns,
    dnssec: parsed.dnssec ?? null,
    dns,
    hostingHint: hostingHint(dns),
    rawWhois,
  };
}
