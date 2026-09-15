import { ProjectDTO } from "@/lib/types";

export interface AuditItem {
  id: string;
  category: string;
  label: string;
  hint: string;
  // Present = auto-detected from data we already have (checkbox is
  // read-only, we decide true/false). Absent = a recommendation the
  // merchant checks off by hand.
  auto?: (project: ProjectDTO) => boolean;
}

function hasTechCategory(project: ProjectDTO, category: string): boolean {
  if (!project.techDetectedJson) return false;
  const tech: { name: string; category: string }[] = JSON.parse(project.techDetectedJson);
  return tech.some((t) => t.category === category);
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

export const AUDIT_ITEMS: AuditItem[] = [
  // --- SEO tecnico ---
  {
    id: "seo-gsc-connected",
    category: "SEO tecnico",
    label: "Google Search Console conectado",
    hint: "Necesario para ver clics, impresiones y posicion real en Google.",
    auto: (p) => p.gscConnectedAt != null,
  },
  {
    id: "seo-keyword-tracked",
    category: "SEO tecnico",
    label: "Al menos una keyword bajo seguimiento",
    hint: "Sin keywords rastreadas no hay forma de medir avance de SEO.",
    auto: (p) => p.keywords.length > 0,
  },
  {
    id: "seo-sitemap",
    category: "SEO tecnico",
    label: "Sitemap.xml enviado en Search Console",
    hint: "Ayuda a Google a descubrir e indexar todas las paginas del sitio.",
  },
  {
    id: "seo-meta-unique",
    category: "SEO tecnico",
    label: "Titulos y meta descripciones unicos por pagina",
    hint: "Evita contenido duplicado y mejora el CTR en resultados de busqueda.",
  },
  {
    id: "seo-ssl",
    category: "SEO tecnico",
    label: "Certificado SSL (https) activo en todo el sitio",
    hint: "Requisito basico de seguridad y de ranking en Google.",
  },
  {
    id: "seo-clean-urls",
    category: "SEO tecnico",
    label: "URLs limpias y descriptivas",
    hint: "Ej. /productos/tenis-blancos en vez de /products/sku12345.",
  },
  {
    id: "seo-crawl-errors",
    category: "SEO tecnico",
    label: "Sin errores de rastreo importantes en Search Console",
    hint: "Revisa el reporte de cobertura de paginas en Search Console.",
  },
  {
    id: "seo-structured-data",
    category: "SEO tecnico",
    label: "Marcado estructurado (schema.org) en productos",
    hint: "Habilita precios, estrellas y disponibilidad en los resultados de Google.",
  },

  // --- Rendimiento ---
  {
    id: "perf-analyzed",
    category: "Rendimiento",
    label: "Velocidad del sitio analizada al menos una vez",
    hint: "Usa la pestaña Velocidad de esta herramienta para revisarla.",
    auto: (p) => p.psiUpdatedAt != null,
  },
  {
    id: "perf-score",
    category: "Rendimiento",
    label: "Rendimiento movil aceptable (50 o mas)",
    hint: "Puntaje de PageSpeed Insights en movil.",
    auto: (p) => (p.psiPerformanceScore ?? 0) >= 50,
  },
  {
    id: "perf-lcp",
    category: "Rendimiento",
    label: "LCP bajo 2.5 segundos",
    hint: "Tiempo en que carga el elemento visual mas grande de la pagina.",
    auto: (p) => p.psiLcpMs != null && p.psiLcpMs <= 2500,
  },
  {
    id: "perf-cls",
    category: "Rendimiento",
    label: "CLS bajo 0.1 (sin saltos visuales)",
    hint: "Que la pagina no se mueva mientras carga.",
    auto: (p) => p.psiCls != null && p.psiCls < 0.1,
  },
  {
    id: "perf-inp",
    category: "Rendimiento",
    label: "INP bajo 200ms (buena capacidad de respuesta)",
    hint: "Que la pagina responda rapido a clics y toques.",
    auto: (p) => p.psiInpMs != null && p.psiInpMs <= 200,
  },
  {
    id: "perf-images",
    category: "Rendimiento",
    label: "Imagenes de producto optimizadas/comprimidas",
    hint: "Imagenes pesadas son la causa mas comun de sitios lentos.",
  },

  // --- Catalogo ---
  {
    id: "cat-public",
    category: "Catalogo",
    label: "Catalogo publico accesible",
    hint: "El catalogo debe poder leerse sin contraseña para que Google lo indexe.",
    auto: (p) => p.ecommerceCheckedAt != null && p.ecommerceIsShopify === true,
  },
  {
    id: "cat-min-products",
    category: "Catalogo",
    label: "Al menos 10 productos publicados",
    hint: "Un catalogo muy chico limita las palabras clave donde puedes aparecer.",
    auto: (p) => (p.ecommerceProductCount ?? 0) >= 10,
  },
  {
    id: "cat-min-collections",
    category: "Catalogo",
    label: "Al menos 3 colecciones organizando el catalogo",
    hint: "Facilita la navegacion y da mas paginas indexables por categoria.",
    auto: (p) => (p.ecommerceCollectionCount ?? 0) >= 3,
  },
  {
    id: "cat-recent-update",
    category: "Catalogo",
    label: "Catalogo actualizado en los ultimos 30 dias",
    hint: "Un catalogo que no cambia nunca le da a Google menos razones para volver a rastrearlo.",
    auto: (p) => {
      const days = daysSince(p.ecommerceNewestProductAt);
      return days != null && days <= 30;
    },
  },
  {
    id: "cat-tags",
    category: "Catalogo",
    label: "Productos con tags para filtros/busqueda",
    hint: "Los tags alimentan los filtros de coleccion y la busqueda interna.",
    auto: (p) => Boolean(p.ecommerceTopTagsJson && JSON.parse(p.ecommerceTopTagsJson).length > 0),
  },
  {
    id: "cat-types",
    category: "Catalogo",
    label: "Productos organizados por tipo/categoria",
    hint: "Ayuda tanto a SEO como a la experiencia de compra.",
    auto: (p) => Boolean(p.ecommerceTopTypesJson && JSON.parse(p.ecommerceTopTypesJson).length > 0),
  },
  {
    id: "cat-images",
    category: "Catalogo",
    label: "Todos los productos con al menos una imagen",
    hint: "Un producto sin imagen practicamente no vende.",
  },
  {
    id: "cat-descriptions",
    category: "Catalogo",
    label: "Descripciones de producto completas (no vacias)",
    hint: "Descripciones vacias son contenido perdido para SEO y para el cliente.",
  },
  {
    id: "cat-prices",
    category: "Catalogo",
    label: "Precios consistentes, sin productos en $0",
    hint: "Un precio en $0 suele ser un error de captura que confunde al cliente.",
  },

  // --- Analitica ---
  {
    id: "an-ga-connected",
    category: "Analitica",
    label: "Google Analytics 4 conectado",
    hint: "Necesario para ver sesiones, usuarios y (si esta configurado) ventas.",
    auto: (p) => p.gaConnectedAt != null,
  },
  {
    id: "an-ga-updated",
    category: "Analitica",
    label: "Metricas de GA4 actualizadas",
    hint: "Usa el boton Actualizar en la pestaña Analiticas.",
    auto: (p) => p.gaAnalyticsUpdatedAt != null,
  },
  {
    id: "an-ga-revenue",
    category: "Analitica",
    label: "Seguimiento de ventas/ingresos configurado en GA4",
    hint: "Sin esto no puedes ver que campañas o paginas generan ventas reales.",
    auto: (p) => p.gaRevenue28d != null,
  },
  {
    id: "an-ga-organic",
    category: "Analitica",
    label: "Trafico organico visible en GA4",
    hint: "Confirma que el sitio si recibe visitas desde busqueda organica.",
    auto: (p) => (p.gaSessionsOrganic28d ?? 0) > 0,
  },

  // --- Marketing y marca ---
  {
    id: "mkt-youtube",
    category: "Marketing y marca",
    label: "Canal de YouTube conectado",
    hint: "Video es un canal fuerte para descubrimiento de producto.",
    auto: (p) => p.youtubeChannelId != null,
  },
  {
    id: "mkt-gbp",
    category: "Marketing y marca",
    label: "Perfil de Google Business conectado",
    hint: "Clave si el negocio tambien tiene presencia fisica o quiere aparecer en Maps.",
    auto: (p) => p.gbpConnectedAt != null,
  },
  {
    id: "mkt-email",
    category: "Marketing y marca",
    label: "Email marketing instalado (Mailchimp, Klaviyo, etc.)",
    hint: "Canal de retencion mas barato que la publicidad paga.",
    auto: (p) => hasTechCategory(p, "Email marketing"),
  },
  {
    id: "mkt-chat",
    category: "Marketing y marca",
    label: "Chat o soporte en vivo instalado",
    hint: "Reduce fricciones de compra y dudas de ultimo momento.",
    auto: (p) => hasTechCategory(p, "Chat / soporte"),
  },
  {
    id: "mkt-reviews",
    category: "Marketing y marca",
    label: "Reseñas de producto habilitadas",
    hint: "La prueba social aumenta conversion de forma medible.",
    auto: (p) => hasTechCategory(p, "Reseñas"),
  },
  {
    id: "mkt-social",
    category: "Marketing y marca",
    label: "Redes sociales vinculadas y activas",
    hint: "Enlaces visibles a Instagram/Facebook/TikTok, con publicaciones recientes.",
  },
  {
    id: "mkt-abandoned-cart",
    category: "Marketing y marca",
    label: "Recuperacion de carrito abandonado configurada",
    hint: "Uno de los correos automaticos con mejor retorno en ecommerce.",
  },
  {
    id: "mkt-promotions",
    category: "Marketing y marca",
    label: "Programa de descuentos/promociones configurado",
    hint: "Codigos de descuento, envio gratis por monto minimo, etc.",
  },

  // --- Confianza y legal ---
  {
    id: "trust-privacy",
    category: "Confianza y legal",
    label: "Politica de privacidad publicada",
    hint: "Requisito legal minimo y esperado por el cliente.",
  },
  {
    id: "trust-terms",
    category: "Confianza y legal",
    label: "Terminos y condiciones publicados",
    hint: "Protege al negocio y aclara reglas de uso del sitio.",
  },
  {
    id: "trust-shipping",
    category: "Confianza y legal",
    label: "Politica de envios publicada",
    hint: "Tiempos, costos y zonas de entrega claras antes de comprar.",
  },
  {
    id: "trust-returns",
    category: "Confianza y legal",
    label: "Politica de devoluciones/reembolsos publicada",
    hint: "Una de las paginas que mas revisan los clientes antes de comprar.",
  },
  {
    id: "trust-contact",
    category: "Confianza y legal",
    label: "Pagina de contacto visible",
    hint: "Un negocio sin forma de contacto visible genera desconfianza.",
  },
  {
    id: "trust-safe-browsing",
    category: "Confianza y legal",
    label: "Dominio no marcado como malicioso/phishing",
    hint: "Verificado contra la lista de Google Safe Browsing.",
    auto: (p) => p.safeBrowsingClean === true,
  },
  {
    id: "trust-knowledge-panel",
    category: "Confianza y legal",
    label: "Panel de conocimiento de Google (marca reconocida)",
    hint: "Señal de que Google ya reconoce la marca como entidad propia.",
    auto: (p) => p.kgFound === true,
  },

  // --- Competencia y estrategia ---
  {
    id: "comp-added",
    category: "Competencia y estrategia",
    label: "Al menos un competidor agregado para comparar",
    hint: "Sin referencia es dificil saber si tus numeros son buenos o malos.",
    auto: (p) => p.competitors.length > 0,
  },
  {
    id: "comp-traffic-analyzed",
    category: "Competencia y estrategia",
    label: "Comparativa de trafico organico vs competencia analizada",
    hint: "Usa el boton Analizar mi dominio en la pestaña Competencia.",
    auto: (p) => p.domainOrganicTrafficEstimate != null,
  },

  // --- Seguridad y mantenimiento ---
  {
    id: "sec-apps",
    category: "Seguridad y mantenimiento",
    label: "Sin apps instaladas que ya no se usan",
    hint: "Apps abandonadas siguen cargando scripts y afectando la velocidad.",
  },
  {
    id: "sec-404",
    category: "Seguridad y mantenimiento",
    label: "Pagina 404 personalizada",
    hint: "Evita que un cliente perdido simplemente se vaya del sitio.",
  },
  {
    id: "sec-favicon",
    category: "Seguridad y mantenimiento",
    label: "Favicon configurado",
    hint: "Detalle pequeño pero que se nota en pestañas del navegador y favoritos.",
  },
  {
    id: "sec-theme-backup",
    category: "Seguridad y mantenimiento",
    label: "Respaldo del tema antes de cambios grandes",
    hint: "Shopify permite duplicar el tema activo como respaldo rapido.",
  },

  // --- Contenido ---
  {
    id: "content-blog",
    category: "Contenido",
    label: "Blog o seccion de contenido activa",
    hint: "Fuente constante de nuevas paginas para posicionar en Google.",
  },
  {
    id: "content-faq",
    category: "Contenido",
    label: "Preguntas frecuentes (FAQ) disponibles",
    hint: "Resuelve objeciones de compra sin depender de soporte.",
  },
];
