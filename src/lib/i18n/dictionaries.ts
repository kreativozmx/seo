export type Locale = "es" | "en";
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
];
export const LOCALE_COOKIE = "ui_lang";

// Spanish is the source of truth (the app was written in it); English falls
// back to Spanish for any key not translated yet, so sections can be
// translated incrementally without breaking anything.
const es = {
  // Sidebar / chrome
  "nav.panel": "Panel",
  "nav.auditoria": "Auditoria",
  "nav.velocidad": "Velocidad",
  "nav.analiticas": "Analiticas",
  "nav.rankings": "Rankings",
  "nav.seo-ia": "SEO IA",
  "nav.youtube": "SEO Youtube",
  "nav.planificacion": "Keywords",
  "nav.changelog": "Actualizaciones Shopify",
  "nav.contenidos": "Contenidos",
  "nav.competencia": "Competencia",
  "nav.monitoreo": "Monitoreo",
  "nav.apps": "Apps iOS/Android",
  "nav.marketplaces": "Marketplaces",
  "nav.notificaciones": "Notificaciones",
  "nav.conexiones": "Conexiones",
  "nav.configuracion": "Ajustes",
  "nav.group.planificacion": "Planificacion",
  "nav.group.estrategia": "Estrategia",
  "chrome.logout": "Cerrar sesión",
  "chrome.readonly": "Vista de solo lectura",
  "footer.privacy": "Política de privacidad",
  "footer.terms": "Términos de servicio",

  // Languages (names)
  "lang.es": "Espanol",
  "lang.en": "Ingles",
  "lang.pt": "Portugues",
  "lang.fr": "Frances",
  "lang.de": "Aleman",
  "lang.it": "Italiano",

  // Ajustes
  "settings.locationLanguage": "Ubicacion e idioma del proyecto",
  "settings.project": "Proyecto",
  "settings.name": "Nombre:",
  "settings.domain": "Dominio:",
  "settings.created": "Creado:",
  "settings.share": "Compartir con el cliente",
  "settings.toolLanguage": "Idioma de la herramienta",
  "settings.toolLanguageHint":
    "Cambia el idioma de los menus y textos de Shopify Audit. No cambia el idioma de tu proyecto (busquedas, keywords) ni el del contenido que genera la IA — eso se define arriba, en \"Ubicacion e idioma del proyecto\".",
  "settings.toolLanguageWip":
    "Estamos traduciendo la herramienta por secciones; lo que aun no este traducido se seguira viendo en espanol.",

  // Contenidos
  "content.title": "Ideas de contenido para el blog",
  "content.description":
    "12 titulos generados con IA a partir de las busquedas reales en Google de los ultimos 7 dias (Search Console), pensados para ayudarte a posicionar.",
  "content.language": "Idioma de generacion:",
  "content.changeLanguage": "Cambiar idioma del proyecto",
  "content.staleLanguage":
    "Estas ideas se generaron en {old}. Dale a \"Generar de nuevo\" para tenerlas en {current}.",
  "content.existingNote": "Al generar, leemos el sitemap de tu sitio para no repetir articulos que ya publicaste.",
  "content.existingCount": "Revisamos {count} articulos ya publicados en tu blog (desde tu sitemap) para no repetir temas.",
  "content.existingNone": "No encontramos articulos de blog en el sitemap de tu sitio, asi que no hay nada que excluir.",
  "content.viewList": "Ver lista",
  "content.hideList": "Ocultar lista",
  "content.copyAll": "Copiar todo",
  "content.copied": "Copiado ✓",
  "content.generate": "Generar ideas",
  "content.regenerate": "Generar de nuevo",
  "content.generating": "Generando...",
  "content.lastTime": "Ultima vez:",
  "content.empty": "Aun no hay ideas generadas. Dale clic a \"Generar ideas\" arriba.",
  "content.titleLabel": "Titulo:",
  "content.keywordsLabel": "Keywords:",
  "content.errorGenerate": "Error al generar ideas",
  "content.needGsc":
    "Necesitas Search Console conectado para generar ideas basadas en busquedas reales — conectalo desde \"Conexiones\".",

  // Notificaciones (weekly email)
  "notif.title": "Resumen semanal por correo",
  "notif.description":
    "Cada lunes recibes un correo con datos reales de tu propio rastreo y de Search Console — no usa creditos de DataForSEO. Elige abajo que secciones incluir.",
  "notif.sendTo": "Enviar a",
  "notif.emailPlaceholder": "tu@correo.com",
  "notif.changeEmailPlaceholder": "Cambiar a otro correo...",
  "notif.saveEmail": "Guardar correo",
  "notif.saving": "Guardando...",
  "notif.saved": "Guardado ✓",
  "notif.removeEmail": "Quitar correo",
  "notif.defaultEmailHint": "Sin un correo aqui, se usa el correo con el que inicias sesion.",
  "notif.invalidEmail": "Correo invalido",
  "notif.section.positions": "Resumen de posiciones",
  "notif.section.positions.hint":
    "Posicion promedio, Top 3, Top 10 y las keywords que mas se movieron — de tu propio rastreo.",
  "notif.section.traffic": "Trafico (Search Console)",
  "notif.section.traffic.hint": "Clics e impresiones de esta semana vs. la anterior, datos reales de GSC.",
  "notif.section.keywords": "Keywords principales",
  "notif.section.keywords.hint": "Tus keywords con mas clics en GSC esta semana, con su posicion y cambio.",
  "notif.section.pages": "Paginas de destino principales",
  "notif.section.pages.hint": "Tus paginas con mas clics en GSC esta semana, con su cambio.",
  "notif.lastSent": "Ultimo enviado:",
  "notif.neverSent": "Aun no se ha enviado ninguno — el primero sale el proximo lunes.",
  "notif.sendTest": "Enviar de prueba ahora",
  "notif.sending": "Enviando...",
  "notif.testSent": "Correo de prueba enviado ✓",
  "notif.testError": "Error al enviar el correo de prueba",

  // Monitoreo > uptime
  "uptime.chartTitle": "Disponibilidad de {domain}",
  "uptime.chartDescription": "Revisamos tu sitio cada 10 minutos y guardamos el historial.",
  "uptime.title": "Avisarme por correo si {domain} se cae",
  "uptime.description":
    "Te mandamos un correo si no responde en 2 revisiones seguidas, y otro cuando vuelve.",
  "uptime.down": "● Caido ahora mismo",
  "uptime.up": "● En linea",
  "uptime.waiting": "Esperando la primera revision (max. 10 min)...",
  "uptime.lastCheck": "ultima revision",
  "uptime.range.24h": "24 horas",
  "uptime.range.7d": "7 dias",
  "uptime.range.30d": "30 dias",
  "uptime.noData": "Sin datos",
  "uptime.failedChecks": "{failures} de {checks} revisiones fallaron",
  "uptime.allUp": "Todo en linea ({checks} revisiones)",
  "uptime.availability": "Disponibilidad:",
  "uptime.avgResponse": "Respuesta prom.:",
  "uptime.legend.up": "En linea",
  "uptime.legend.down": "Caida",
  "uptime.legend.none": "Sin datos",
  "uptime.alertsTo": "Enviar alertas a",
  "uptime.sameAsReports": "El mismo correo de los reportes (Notificaciones)",
  "uptime.addPlaceholder": "otro@correo.com",
  "uptime.addEmail": "Agregar correo",
  "uptime.noRecipients":
    "Sin destinatarios: agrega al menos un correo o activa el de los reportes, si no no recibiras alertas.",
  "uptime.willSendTo": "Se enviara a:",
  "uptime.sendTests": "Enviar correos de prueba",
  "uptime.testsSent": "Enviamos 2 correos de prueba a {to} ✓",
  "uptime.recentIncidents": "Caidas recientes",
  "uptime.stillDown": "sigue caido",
};

const en: Partial<Record<keyof typeof es, string>> = {
  "nav.panel": "Dashboard",
  "nav.auditoria": "Audit",
  "nav.velocidad": "Speed",
  "nav.analiticas": "Analytics",
  "nav.rankings": "Rankings",
  "nav.seo-ia": "AI SEO",
  "nav.youtube": "YouTube SEO",
  "nav.planificacion": "Keywords",
  "nav.changelog": "Shopify Updates",
  "nav.contenidos": "Content",
  "nav.competencia": "Competition",
  "nav.monitoreo": "Monitoring",
  "nav.apps": "iOS/Android Apps",
  "nav.marketplaces": "Marketplaces",
  "nav.notificaciones": "Notifications",
  "nav.conexiones": "Connections",
  "nav.configuracion": "Settings",
  "nav.group.planificacion": "Planning",
  "nav.group.estrategia": "Strategy",
  "chrome.logout": "Log out",
  "chrome.readonly": "Read-only view",
  "footer.privacy": "Privacy policy",
  "footer.terms": "Terms of service",

  "lang.es": "Spanish",
  "lang.en": "English",
  "lang.pt": "Portuguese",
  "lang.fr": "French",
  "lang.de": "German",
  "lang.it": "Italian",

  "settings.locationLanguage": "Project location & language",
  "settings.project": "Project",
  "settings.name": "Name:",
  "settings.domain": "Domain:",
  "settings.created": "Created:",
  "settings.share": "Share with the client",
  "settings.toolLanguage": "Tool language",
  "settings.toolLanguageHint":
    "Changes the language of Shopify Audit's menus and text. It does not change your project's language (searches, keywords) or the language of AI-generated content — that is set above, in \"Project location & language\".",
  "settings.toolLanguageWip":
    "We're translating the tool section by section; anything not translated yet will keep showing in Spanish.",

  "content.title": "Blog content ideas",
  "content.description":
    "12 AI-generated titles based on real Google searches from the last 7 days (Search Console), designed to help you rank.",
  "content.language": "Generation language:",
  "content.changeLanguage": "Change project language",
  "content.staleLanguage":
    "These ideas were generated in {old}. Click \"Generate again\" to get them in {current}.",
  "content.existingNote": "When generating, we read your site's sitemap so we don't repeat articles you've already published.",
  "content.existingCount": "We checked {count} articles already published on your blog (from your sitemap) to avoid repeating topics.",
  "content.existingNone": "We couldn't find blog articles in your site's sitemap, so there's nothing to exclude.",
  "content.viewList": "View list",
  "content.hideList": "Hide list",
  "content.copyAll": "Copy all",
  "content.copied": "Copied ✓",
  "content.generate": "Generate ideas",
  "content.regenerate": "Generate again",
  "content.generating": "Generating...",
  "content.lastTime": "Last time:",
  "content.empty": "No ideas generated yet. Click \"Generate ideas\" above.",
  "content.titleLabel": "Title:",
  "content.keywordsLabel": "Keywords:",
  "content.errorGenerate": "Error generating ideas",
  "content.needGsc":
    "You need Search Console connected to generate ideas based on real searches — connect it from \"Connections\".",

  "notif.title": "Weekly email summary",
  "notif.description":
    "Every Monday you get an email with real data from your own tracking and Search Console — it doesn't use DataForSEO credits. Choose below which sections to include.",
  "notif.sendTo": "Send to",
  "notif.emailPlaceholder": "you@email.com",
  "notif.changeEmailPlaceholder": "Change to another email...",
  "notif.saveEmail": "Save email",
  "notif.saving": "Saving...",
  "notif.saved": "Saved ✓",
  "notif.removeEmail": "Remove email",
  "notif.defaultEmailHint": "Without an email here, the email you log in with is used.",
  "notif.invalidEmail": "Invalid email",
  "notif.section.positions": "Position summary",
  "notif.section.positions.hint":
    "Average position, Top 3, Top 10 and the keywords that moved the most — from your own tracking.",
  "notif.section.traffic": "Traffic (Search Console)",
  "notif.section.traffic.hint": "Clicks and impressions this week vs. last week, real GSC data.",
  "notif.section.keywords": "Top keywords",
  "notif.section.keywords.hint": "Your keywords with the most clicks in GSC this week, with position and change.",
  "notif.section.pages": "Top landing pages",
  "notif.section.pages.hint": "Your pages with the most clicks in GSC this week, with their change.",
  "notif.lastSent": "Last sent:",
  "notif.neverSent": "None sent yet — the first one goes out next Monday.",
  "notif.sendTest": "Send a test now",
  "notif.sending": "Sending...",
  "notif.testSent": "Test email sent ✓",
  "notif.testError": "Error sending the test email",

  "uptime.chartTitle": "{domain} availability",
  "uptime.chartDescription": "We check your site every 10 minutes and keep the history.",
  "uptime.title": "Email me if {domain} goes down",
  "uptime.description":
    "We email you if it doesn't respond in 2 consecutive checks, and again when it comes back.",
  "uptime.down": "● Down right now",
  "uptime.up": "● Online",
  "uptime.waiting": "Waiting for the first check (max. 10 min)...",
  "uptime.lastCheck": "last check",
  "uptime.range.24h": "24 hours",
  "uptime.range.7d": "7 days",
  "uptime.range.30d": "30 days",
  "uptime.noData": "No data",
  "uptime.failedChecks": "{failures} of {checks} checks failed",
  "uptime.allUp": "All online ({checks} checks)",
  "uptime.availability": "Availability:",
  "uptime.avgResponse": "Avg. response:",
  "uptime.legend.up": "Online",
  "uptime.legend.down": "Down",
  "uptime.legend.none": "No data",
  "uptime.alertsTo": "Send alerts to",
  "uptime.sameAsReports": "The same email as the reports (Notifications)",
  "uptime.addPlaceholder": "another@email.com",
  "uptime.addEmail": "Add email",
  "uptime.noRecipients":
    "No recipients: add at least one email or turn on the reports email, otherwise you won't receive alerts.",
  "uptime.willSendTo": "Will be sent to:",
  "uptime.sendTests": "Send test emails",
  "uptime.testsSent": "We sent 2 test emails to {to} ✓",
  "uptime.recentIncidents": "Recent outages",
  "uptime.stillDown": "still down",
};

export type TranslationKey = keyof typeof es;
export const DICTIONARIES: Record<Locale, Partial<Record<TranslationKey, string>>> = { es, en };

export function translate(locale: Locale, key: TranslationKey, vars?: Record<string, string | number>) {
  let text = DICTIONARIES[locale][key] ?? es[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}
