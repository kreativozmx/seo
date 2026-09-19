// Google Ads / DataForSEO geo-target location codes for the countries this
// tool is most likely to be used for. Full list: https://api.dataforseo.com/v3/serp/google/locations
export const LOCATIONS = [
  { code: "2484", label: "Mexico" },
  { code: "2840", label: "Estados Unidos" },
  { code: "2724", label: "Espana" },
  { code: "2032", label: "Argentina" },
  { code: "2076", label: "Brasil" },
  { code: "2152", label: "Chile" },
  { code: "2170", label: "Colombia" },
  { code: "2604", label: "Peru" },
  { code: "2218", label: "Ecuador" },
  { code: "2862", label: "Venezuela" },
  { code: "2320", label: "Guatemala" },
  { code: "2188", label: "Costa Rica" },
  { code: "2591", label: "Panama" },
  { code: "2214", label: "Republica Dominicana" },
  { code: "2068", label: "Bolivia" },
  { code: "2600", label: "Paraguay" },
  { code: "2858", label: "Uruguay" },
  { code: "2222", label: "El Salvador" },
  { code: "2340", label: "Honduras" },
  { code: "2558", label: "Nicaragua" },
  { code: "2826", label: "Reino Unido" },
  { code: "2124", label: "Canada" },
  { code: "2250", label: "Francia" },
  { code: "2276", label: "Alemania" },
  { code: "2380", label: "Italia" },
  { code: "2620", label: "Portugal" },
] as const;

export const LANGUAGES = [
  { code: "es", label: "Espanol" },
  { code: "en", label: "Ingles" },
  { code: "pt", label: "Portugues" },
  { code: "fr", label: "Frances" },
  { code: "de", label: "Aleman" },
  { code: "it", label: "Italiano" },
] as const;

// Language names as used inside AI prompts ("escribe en ..."), by the
// project's languageCode.
export const LANGUAGE_PROMPT_NAMES: Record<string, string> = {
  es: "español",
  en: "inglés",
  pt: "portugués",
  fr: "francés",
  de: "alemán",
  it: "italiano",
};

// DataForSEO location code -> Google "gl" country code (for autocomplete etc.).
export const LOCATION_GL: Record<string, string> = {
  "2484": "mx", "2840": "us", "2724": "es", "2032": "ar", "2076": "br", "2152": "cl", "2170": "co",
  "2604": "pe", "2218": "ec", "2862": "ve", "2320": "gt", "2188": "cr", "2591": "pa", "2214": "do",
  "2068": "bo", "2600": "py", "2858": "uy", "2222": "sv", "2340": "hn", "2558": "ni", "2826": "gb",
  "2124": "ca", "2250": "fr", "2276": "de", "2380": "it", "2620": "pt",
};

// Location -> local currency code. Frankfurter (ECB rates) only covers some
// of these; the rest fall back to showing USD.
export const LOCATION_CURRENCY: Record<string, string> = {
  "2484": "MXN", "2840": "USD", "2724": "EUR", "2032": "ARS", "2076": "BRL", "2152": "CLP", "2170": "COP",
  "2604": "PEN", "2218": "USD", "2862": "VES", "2320": "GTQ", "2188": "CRC", "2591": "USD", "2214": "DOP",
  "2068": "BOB", "2600": "PYG", "2858": "UYU", "2222": "USD", "2340": "HNL", "2558": "NIO", "2826": "GBP",
  "2124": "CAD", "2250": "EUR", "2276": "EUR", "2380": "EUR", "2620": "EUR",
};
