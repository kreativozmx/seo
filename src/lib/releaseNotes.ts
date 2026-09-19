// Product changelog shown from the "Novedades" button in the top bar.
// When you ship something new, add an entry at the TOP of this list (newest
// first) — the button shows an unread dot until the user opens it.
export interface ReleaseNote {
  id: string; // unique + stable, e.g. "2026-09-18-tareas"
  date: string; // YYYY-MM-DD
  title: { es: string; en: string };
  items: { es: string[]; en: string[] };
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "2026-09-18-agregar-a-tareas",
    date: "2026-09-18",
    title: {
      es: "Agregar a Tareas, modo pluma y más",
      en: "Add to Tasks, pen mode and more",
    },
    items: {
      es: [
        "Agregar a Tareas: botón \"+ Tarea\" en la auditoría, competencia, inspección de URLs, historial del sitio, enlaces rotos, PageSpeed, ideas de blog e ideas de video; también puedes elegir varias con casillas y agregarlas de golpe.",
        "Modo presentación: nueva pluma para dibujar sobre la pantalla (4 colores, trazo fino o grueso, deshacer y borrar), aparte del láser.",
        "Competencia: signos \"?\" con explicaciones en palabras simples en cada métrica.",
        "Autoridad de dominio (Open PageRank) ahora usa la nueva API alojada por Keywords Everywhere.",
        "Nueva insignia Beta junto al logo y botón Novedades en la barra superior.",
      ],
      en: [
        "Add to Tasks: \"+ Task\" button in the audit, competition, URL inspection, site history, broken links, PageSpeed, blog ideas and video ideas; you can also tick several and add them at once.",
        "Presentation mode: new pen to draw on screen (4 colors, thin or thick stroke, undo and clear), alongside the laser.",
        "Competition: \"?\" tooltips with plain-language explanations on every metric.",
        "Domain authority (Open PageRank) now uses the new API hosted by Keywords Everywhere.",
        "New Beta badge next to the logo and a What's new button in the top bar.",
      ],
    },
  },
  {
    id: "2026-09-18-auditoria-automatica",
    date: "2026-09-18",
    title: {
      es: "Auditoría automática, consulta de dominio y nueva barra superior",
      en: "Automatic audit, domain lookup and a new top bar",
    },
    items: {
      es: [
        "Nueva barra superior con enlaces: Proyectos, Actualizaciones Shopify y Consultar dominio.",
        "Consultar dominio: descubre quién está detrás de cualquier dominio (registrador, titular cuando es público, fechas, DNS y hosting).",
        "Auditoría automática: revisamos tu sitio en vivo (SSL y su vigencia, redirección a https, robots.txt, sitemap, etiquetas SEO, páginas legales, favicon, 404…) y marcamos solas unas 25 casillas.",
        "Indexación en Google: le preguntamos a Search Console si tus páginas clave están indexadas y cuándo las rastreó.",
        "Historial del sitio (Wayback Machine): páginas que existieron antes y hoy dan error, listas para redireccionar.",
        "Keywords: ideas gratis del autocompletado de Google, con expansión A-Z.",
        "Competencia: valores en tu moneda local y columna de autoridad de dominio (Open PageRank).",
        "Videos: investigación de YouTube (qué funciona hoy para una palabra clave) y preguntas reales de tu audiencia para generar mejores títulos.",
      ],
      en: [
        "New top bar with links: Projects, Shopify Updates and Domain lookup.",
        "Domain lookup: find out who is behind any domain (registrar, owner when public, dates, DNS and hosting).",
        "Automatic audit: we check your live site (SSL and its expiry, https redirect, robots.txt, sitemap, SEO tags, legal pages, favicon, 404…) and tick about 25 checklist items for you.",
        "Google indexing: we ask Search Console whether your key pages are indexed and when they were crawled.",
        "Site history (Wayback Machine): pages that used to exist and now error out, ready to redirect.",
        "Keywords: free ideas from Google autocomplete, with A-Z expansion.",
        "Competition: values in your local currency and a domain authority column (Open PageRank).",
        "Videos: YouTube research (what works today for a keyword) and real audience questions to generate better titles.",
      ],
    },
  },
  {
    id: "2026-09-18-tareas-videos",
    date: "2026-09-18",
    title: { es: "Tareas, Videos e idioma de la herramienta", en: "Tasks, Videos and tool language" },
    items: {
      es: [
        "Tareas: gestor de tareas por proyecto con propietario, estado, cronograma con calendario y conversación en cada tarea.",
        "Invita a personas externas: reciben un enlace personal para ver sus tareas, cambiar estado y fechas, y comentar, sin crear cuenta.",
        "Reordena tareas arrastrando y ajusta el ancho de las columnas.",
        "Videos (Estrategia): conecta tu canal en Conexiones y genera títulos por tipo de video y nivel de viralidad, en formato checklist.",
        "Contenidos: 6 ideas por generación en el idioma de tu proyecto, sin repetir lo que ya publicaste (leemos tu sitemap).",
        "Idioma de la herramienta: español o inglés desde Ajustes.",
      ],
      en: [
        "Tasks: per-project task manager with owner, status, a calendar timeline and a conversation on each task.",
        "Invite external people: they get a personal link to see their tasks, change status and dates, and comment, no account needed.",
        "Reorder tasks by dragging and resize columns.",
        "Videos (Strategy): connect your channel in Connections and generate titles by video type and virality level, as a checklist.",
        "Content: 6 ideas per generation in your project's language, without repeating what you've already published (we read your sitemap).",
        "Tool language: Spanish or English from Settings.",
      ],
    },
  },
  {
    id: "2026-09-17-monitoreo-presentacion",
    date: "2026-09-17",
    title: { es: "Monitoreo de caídas, modo presentación y más", en: "Downtime monitoring, presentation mode and more" },
    items: {
      es: [
        "Monitoreo: revisamos tu sitio cada 10 minutos, mostramos la disponibilidad en una gráfica y te avisamos por correo si se cae (y cuando vuelve).",
        "Modo presentación: zoom de pantalla y cursor láser para videollamadas.",
        "Botón de captura en las gráficas para descargarlas como imagen PNG.",
        "Competencia: compara contra semanas o meses anteriores, y agrega competidores desde el mismo panel.",
        "Analíticas: comportamiento por página (scroll y tiempo) y gráficas de pastel para dispositivos y canales.",
        "Rankings: botón SERP con todos los sitios que te superan en Google.",
      ],
      en: [
        "Monitoring: we check your site every 10 minutes, chart its availability and email you if it goes down (and when it's back).",
        "Presentation mode: screen zoom and a laser cursor for video calls.",
        "Capture button on charts to download them as PNG images.",
        "Competition: compare against previous weeks or months, and add competitors from the same panel.",
        "Analytics: per-page behavior (scroll and time) and pie charts for devices and channels.",
        "Rankings: SERP button showing every site that outranks you on Google.",
      ],
    },
  },
  {
    id: "2026-09-16-resumen-semanal",
    date: "2026-09-16",
    title: { es: "Resumen semanal por correo", en: "Weekly email summary" },
    items: {
      es: [
        "Cada lunes recibes un correo con tus posiciones, tráfico de Search Console, keywords y páginas principales, con tu logo y enlace a la herramienta.",
        "Elige qué secciones recibir y a qué correo(s) enviarlo desde Notificaciones, con envío de prueba.",
      ],
      en: [
        "Every Monday you get an email with your positions, Search Console traffic, top keywords and pages, with your logo and a link to the tool.",
        "Choose which sections to receive and which email address(es) to send it to from Notifications, with a test send.",
      ],
    },
  },
];
