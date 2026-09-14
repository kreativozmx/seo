// Google PageSpeed Insights API (v5) — free, works without an API key
// (very low anonymous quota) or with GOOGLE_API_KEY for a real per-project
// quota (25k/day free).
// Docs: https://developers.google.com/speed/docs/insights/v5/get-started

const BASE_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export interface PageSpeedIssue {
  id: string;
  title: string;
  description: string; // plain-English recommendation, from Lighthouse
  displayValue: string | null; // e.g. "Potential savings of 1.2 s"
  score: number | null; // 0-1, lower = worse
}

export interface PageSpeedResult {
  performanceScore: number | null; // 0-100
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  source: "field" | "lab"; // real CrUX data vs. simulated lab run
  issues: PageSpeedIssue[];
}

// Strips Lighthouse's markdown links ([text](url)) down to plain text so
// the recommendation reads cleanly without a markdown renderer.
function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// Lighthouse audit IDs are a fixed, known set — translate the common ones
// to plain Spanish instructions instead of showing Google's English text.
const SPANISH_TRANSLATIONS: Record<string, { title: string; description: string }> = {
  "render-blocking-resources": {
    title: "Elimina recursos que bloquean la primera carga",
    description: "Hay archivos CSS o JavaScript que detienen la carga inicial de la pagina. Cargalos de forma diferida o aplazalos para que el contenido aparezca antes.",
  },
  "unused-css-rules": {
    title: "Quita el CSS que no se usa",
    description: "Tu sitio carga estilos que no se aplican en esta pagina. Elimina el CSS sobrante o divide los estilos por seccion.",
  },
  "unused-javascript": {
    title: "Quita el JavaScript que no se usa",
    description: "Hay codigo JavaScript que se descarga pero no se ejecuta en esta pagina. Elimina scripts o plugins que no necesites.",
  },
  "uses-optimized-images": {
    title: "Optimiza tus imagenes",
    description: "Algunas imagenes pesan mas de lo necesario. Comprimelas o usa un formato mas eficiente (WebP/AVIF) sin perder calidad visible.",
  },
  "efficiently-encode-images": {
    title: "Comprime mejor tus imagenes",
    description: "Puedes reducir el peso de tus imagenes con mejor compresion sin que se note la diferencia.",
  },
  "uses-responsive-images": {
    title: "Sirve imagenes del tamaño correcto",
    description: "Estas enviando imagenes mas grandes de lo que se muestran en pantalla, sobre todo en celular. Ajusta el tamaño segun el dispositivo.",
  },
  "modern-image-formats": {
    title: "Usa formatos de imagen modernos",
    description: "Cambia tus imagenes JPEG/PNG por WebP o AVIF — pesan menos con la misma calidad.",
  },
  "unminified-css": {
    title: "Minifica el CSS",
    description: "Tus archivos CSS tienen espacios y comentarios innecesarios. Minificarlos reduce su peso.",
  },
  "unminified-javascript": {
    title: "Minifica el JavaScript",
    description: "Tus archivos JavaScript se pueden comprimir quitando espacios y codigo innecesario para que carguen mas rapido.",
  },
  "uses-text-compression": {
    title: "Activa compresion de texto (gzip/brotli)",
    description: "Tu servidor no esta comprimiendo el HTML/CSS/JS antes de enviarlo. Activar compresion reduce mucho el tiempo de descarga.",
  },
  "server-response-time": {
    title: "Mejora el tiempo de respuesta del servidor",
    description: "Tu servidor tarda en responder la primera peticion. Considera un mejor hosting, cache del lado del servidor, o un CDN.",
  },
  "font-display": {
    title: "Evita texto invisible mientras cargan las fuentes",
    description: "Usa font-display: swap en tus fuentes para que el texto se vea con una fuente del sistema mientras carga la fuente personalizada.",
  },
  "third-party-summary": {
    title: "Reduce el impacto de scripts de terceros",
    description: "Pixeles, chats y widgets de apps externas estan retrasando la carga. Revisa cuales realmente necesitas activos.",
  },
  "largest-contentful-paint-element": {
    title: "Acelera el elemento principal visible",
    description: "El elemento mas grande de tu pantalla inicial (imagen, titulo) tarda en aparecer. Priorizalo cargandolo antes que otros recursos.",
  },
  "uses-rel-preconnect": {
    title: "Preconecta con dominios externos importantes",
    description: "Agrega 'preconnect' a los dominios externos criticos (CDN de imagenes, fuentes) para que el navegador se conecte antes de necesitarlos.",
  },
  "critical-request-chains": {
    title: "Acorta las cadenas de peticiones criticas",
    description: "Hay muchos recursos que dependen unos de otros antes de poder mostrar la pagina. Simplifica esas dependencias.",
  },
  "dom-size": {
    title: "Reduce el tamaño del HTML de la pagina",
    description: "Tu pagina tiene demasiados elementos HTML, lo que hace mas lento el renderizado. Simplifica el diseño o pagina el contenido.",
  },
  "bootup-time": {
    title: "Reduce el tiempo de ejecucion de JavaScript",
    description: "El navegador tarda mucho procesando JavaScript. Elimina scripts que no aporten o cargalos solo cuando se necesiten.",
  },
  "mainthread-work-breakdown": {
    title: "Reduce el trabajo del hilo principal",
    description: "El navegador esta ocupado procesando codigo en vez de mostrar la pagina. Reduce animaciones pesadas o scripts complejos.",
  },
  "duplicated-javascript": {
    title: "Elimina JavaScript duplicado",
    description: "Se esta cargando el mismo codigo mas de una vez (por ejemplo, la misma libreria en distintos plugins). Unifica versiones.",
  },
  "legacy-javascript": {
    title: "Evita enviar JavaScript antiguo innecesario",
    description: "Se esta enviando codigo compatible con navegadores muy viejos que casi nadie usa. Actualiza la configuracion de tu build para no incluirlo.",
  },
  "total-byte-weight": {
    title: "Reduce el peso total de la pagina",
    description: "En total, esta pagina pesa mas de lo recomendado. Revisa imagenes, videos y scripts grandes.",
  },
  "cumulative-layout-shift": {
    title: "Evita que la pagina 'salte' mientras carga",
    description: "Elementos como imagenes, anuncios o botones se mueven despues de cargar. Dales un tamaño o espacio fijo desde el inicio.",
  },
  "non-composited-animations": {
    title: "Optimiza tus animaciones",
    description: "Algunas animaciones no son eficientes para el navegador y pueden verse entrecortadas. Usa transform/opacity en vez de otras propiedades.",
  },
  "image-delivery": {
    title: "Mejora como entregas las imagenes",
    description: "Puedes ahorrar peso ajustando compresion, tamaño y formato de tus imagenes.",
  },
  "render-blocking-insight": {
    title: "Elimina recursos que bloquean el renderizado",
    description: "Hay CSS o JS que impiden que el navegador muestre contenido de inmediato. Cargalos de forma asincrona cuando sea posible.",
  },
  "uses-long-cache-ttl": {
    title: "Activa una politica de cache eficiente",
    description: "Tu servidor no le dice al navegador que guarde imagenes/CSS/JS por mucho tiempo. Configura encabezados de cache para que las visitas repetidas carguen mas rapido.",
  },
  "cache-insight": {
    title: "Activa una politica de cache eficiente",
    description: "Tu servidor no le dice al navegador que guarde imagenes/CSS/JS por mucho tiempo. Configura encabezados de cache para que las visitas repetidas carguen mas rapido.",
  },
  "layout-shift-elements": {
    title: "Revisa los elementos que se mueven al cargar",
    description: "Estos elementos son los principales responsables de que la pagina 'salte'. Dales un tamaño o espacio fijo desde el inicio.",
  },
  "layout-shifts": {
    title: "Revisa los elementos que se mueven al cargar",
    description: "Estos elementos son los principales responsables de que la pagina 'salte'. Dales un tamaño o espacio fijo desde el inicio.",
  },
  "long-tasks": {
    title: "Reduce las tareas largas de JavaScript",
    description: "Hay bloques de codigo que ocupan el navegador por mucho tiempo seguido, haciendo que la pagina no responda a clics. Divide ese codigo en partes mas pequeñas.",
  },
  "uses-passive-event-listeners": {
    title: "Mejora el scroll de la pagina",
    description: "Algunos scripts pueden estar retrasando el desplazamiento (scroll) de la pagina. Marca esos eventos como 'passive' para que el navegador no tenga que esperarlos.",
  },
  "no-document-write": {
    title: "Evita document.write()",
    description: "Hay un script usando una tecnica antigua (document.write) que retrasa la carga de la pagina, sobre todo en conexiones lentas. Reemplazalo por una forma moderna de insertar contenido.",
  },
  "lcp-lazy-loaded": {
    title: "No retrases la carga de tu imagen principal",
    description: "La imagen mas grande de tu pantalla inicial esta configurada con carga diferida (lazy load), lo cual la retrasa. Quita el lazy load solo de esa imagen para que aparezca de inmediato.",
  },
  "prioritize-lcp-image": {
    title: "Prioriza la carga de tu imagen principal",
    description: "La imagen mas grande de tu pantalla inicial deberia cargarse primero. Agrega 'fetchpriority=high' o precarga esa imagen.",
  },
  "preload-lcp-image": {
    title: "Precarga tu imagen principal",
    description: "La imagen mas grande de tu pantalla inicial deberia cargarse primero. Agrega 'fetchpriority=high' o precarga esa imagen.",
  },
  "forced-reflow-insight": {
    title: "Evita forzar recalculos de diseño",
    description: "Algunos scripts obligan al navegador a recalcular el diseño de la pagina repetidamente, lo cual la hace lenta. Revisa el codigo que mide o cambia el tamaño de elementos.",
  },
  "network-dependency-tree-insight": {
    title: "Acorta las cadenas de peticiones criticas",
    description: "Hay muchos recursos que dependen unos de otros antes de poder mostrar la pagina. Simplifica esas dependencias o carga menos cosas antes del primer render.",
  },
  "interaction-to-next-paint-insight": {
    title: "Mejora la capacidad de respuesta a clics",
    description: "Tu sitio tarda en reaccionar cuando alguien hace clic o toca la pantalla. Reduce scripts pesados que se ejecutan durante la interaccion.",
  },
  "viewport-insight": {
    title: "Configura correctamente el viewport",
    description: "Falta o esta mal configurada la etiqueta viewport, lo que puede hacer que tu sitio se vea mal o lento en celulares.",
  },
};

function translateIssue(id: string, title: string, description: string) {
  const translation = SPANISH_TRANSLATIONS[id];
  if (translation) return translation;
  return { title, description };
}

interface LighthouseAudit {
  scoreDisplayMode?: string;
  score?: number | null;
  title?: string;
  description?: string;
  displayValue?: string;
  numericValue?: number;
}

function extractIssues(audits: Record<string, LighthouseAudit>): PageSpeedIssue[] {
  const items: PageSpeedIssue[] = [];
  for (const [id, audit] of Object.entries(audits)) {
    if (!audit || typeof audit !== "object") continue;
    if (audit.scoreDisplayMode !== "binary" && audit.scoreDisplayMode !== "numeric") continue;
    if (typeof audit.score !== "number" || audit.score >= 0.9) continue;
    if (!audit.title || !audit.description) continue;
    const translated = translateIssue(id, audit.title, stripMarkdownLinks(audit.description));
    items.push({
      id,
      title: translated.title,
      description: translated.description,
      displayValue: audit.displayValue ?? null,
      score: audit.score,
    });
  }
  return items.sort((a, b) => (a.score ?? 1) - (b.score ?? 1)).slice(0, 10);
}

export async function fetchPageSpeed(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<PageSpeedResult> {
  const params = new URLSearchParams({
    url,
    strategy,
    category: "PERFORMANCE",
  });
  if (process.env.GOOGLE_API_KEY) {
    params.set("key", process.env.GOOGLE_API_KEY);
  }

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed Insights request failed (${res.status}): ${text}`);
  }

  const json = await res.json();

  const performanceScore = json?.lighthouseResult?.categories?.performance?.score;
  const audits = json?.lighthouseResult?.audits ?? {};
  const issues = extractIssues(audits);

  const fieldMetrics = json?.loadingExperience?.metrics;
  if (fieldMetrics) {
    return {
      performanceScore:
        performanceScore != null ? Math.round(performanceScore * 100) : null,
      lcpMs: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
      cls: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
        ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
        : null,
      inpMs: fieldMetrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
      source: "field",
      issues,
    };
  }

  // Fall back to lab data (simulated run) when there isn't enough real-user
  // traffic in the Chrome UX Report for this URL.
  return {
    performanceScore:
      performanceScore != null ? Math.round(performanceScore * 100) : null,
    lcpMs: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    inpMs:
      audits["interaction-to-next-paint"]?.numericValue ??
      audits["max-potential-fid"]?.numericValue ??
      null,
    source: "lab",
    issues,
  };
}
