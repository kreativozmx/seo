# Shopify Audit

Herramienta de seguimiento de posiciones en buscadores (Google, Bing) e IA
(ChatGPT, Perplexity, Google AI Overview) por proyecto/cliente, con
competidores, comparativas, SEO de YouTube y auditoría de catálogo Shopify.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Prisma + SQLite (base de datos local, fácil de migrar a Postgres/MySQL)
- Recharts para las gráficas de posición
- [DataForSEO](https://dataforseo.com) como proveedor de rastreo real de
  Google/Bing

## Arranque

```bash
npm install
npx prisma db push
npm run dev
```

Abre http://localhost:3000

### Rastreo diario automático

En otra terminal, deja corriendo:

```bash
npm run cron
```

Este proceso ligero (separado del servidor de Next.js) llama todos los
días a las **6:00 AM** al endpoint que revisa cada keyword de Google/Bing
de todos los proyectos, y refresca el historial e indicadores de Search
Console de los proyectos conectados. Necesita que `npm run dev` (o
`npm run start` en producción) siga corriendo al mismo tiempo — es el que
de verdad hace las consultas.

Para probarlo sin esperar al horario, o para forzar un rastreo manual de
todo:

```bash
curl -X POST http://localhost:3000/api/cron/run-daily
```

Puedes cambiar el horario con la variable `CRON_SCHEDULE` (formato cron,
ver [crontab.guru](https://crontab.guru)), por ejemplo para correr cada 6
horas:

```bash
CRON_SCHEDULE="0 */6 * * *" npm run cron
```

> Nota: como DataForSEO cobra por consulta, el rastreo diario consume
> creditos de tu cuenta automaticamente todos los dias por cada keyword de
> Google/Bing activa. La importacion de GSC no tiene costo.

## Configuración

Copia `.env.example` a `.env.local` y agrega tus credenciales de DataForSEO
(login/password, autenticación básica):

```
DATAFORSEO_LOGIN="tu-email"
DATAFORSEO_PASSWORD="tu-password"
```

### Conectar Google Search Console

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   crea (o usa) un proyecto, habilita la **Search Console API** (APIs &
   Services > Library) y crea un **OAuth Client ID** de tipo
   **"Web application"**.
2. Agrega como *Authorized redirect URI*:
   `http://localhost:3000/api/gsc/callback` (ajusta el dominio cuando
   despliegues en producción).
3. Copia el Client ID y Client Secret a `.env.local`:

```
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/gsc/callback"
```

4. Dentro de cada proyecto en la app, usa el botón **"Conectar Google
   Search Console"**. Se autoriza con tu cuenta de Google, la app busca
   automáticamente la propiedad verificada que coincide con el dominio del
   proyecto (`sc-domain:dominio.com` o `https://dominio.com/`), y queda
   lista para importar.
5. El botón **"Importar desde GSC"** trae las keywords con más impresiones
   de los últimos 28 días junto con su posición promedio real, y las
   agrega como keywords rastreadas del proyecto.

### API key compartida (PageSpeed, YouTube, y otras)

Estas APIs se autentican solo con una API key (sin OAuth). Sin key,
PageSpeed funciona mal — Google enruta las llamadas sin key a un
"consumer" anónimo con cuota 0 y falla con error 429. Necesitas una key
propia:

1. En [Google Cloud Console](https://console.cloud.google.com/apis/library)
   habilita **"PageSpeed Insights API"** y **"YouTube Data API v3"**.
2. Crea una **API key** en Credentials, restringida a esas APIs.
3. Agrégala a `.env.local`:

```
GOOGLE_API_KEY="..."
```

**"Analizar velocidad"** (pestaña Velocidad) mide el rendimiento móvil
(Core Web Vitals: LCP, CLS, INP), con datos reales de Chrome UX Report
cuando el sitio tiene suficiente tráfico, o una corrida de laboratorio
simulada si no.

> Knowledge Graph Search API y Safe Browsing API quedaron implementadas
> en el backend (`src/lib/providers/knowledgeGraph.ts` y
> `safeBrowsing.ts`) pero ocultas de la interfaz por ahora. Si las quieres
> de vuelta, habilítalas en Cloud Console, agrégalas a las restricciones
> de la key, y pide reactivar esas secciones.

### Google Analytics (GA4)

Reutiliza el mismo OAuth Client ID/Secret de arriba — solo necesitas
habilitar **"Google Analytics Data API"** en Google Cloud Console (APIs &
Services > Library).

1. Botón **"Conectar Google Analytics"** en el proyecto — autoriza con tu
   cuenta de Google (scope de solo lectura).
2. Pega el **Property ID** numérico de GA4 (Admin > Property details en
   Analytics, es un número tipo `123456789`, no el Measurement ID `G-...`).
3. **"Actualizar métricas"** trae sesiones, usuarios y conversiones de los
   últimos 28 días.

### Google Business Profile (requiere aprobación de Google)

También reutiliza el mismo OAuth Client ID/Secret. Habilita **"Business
Profile Performance API"** en Google Cloud Console.

⚠️ A diferencia de GSC y GA4, esta API arranca con **cuota 0** en
proyectos nuevos de Cloud — Google exige una solicitud manual de acceso
("Business Profile APIs access request") que puede tardar días o semanas
en aprobarse. Hasta que te aprueben, verás un error 403 de cuota al
actualizar métricas; el botón de conexión y el campo de location quedan
listos para cuando la tengas.

1. Botón **"Conectar Business Profile"** — autoriza con la cuenta de
   Google dueña de la ficha de negocio.
2. Pega el **location** en formato `locations/123456789` (lo obtienes
   listando tus ubicaciones vía la My Business Account Management API, o
   desde herramientas de terceros — no hay forma de verlo directo en la
   interfaz de Google Business Profile).
3. **"Actualizar métricas"** trae impresiones (búsqueda + Maps), llamadas,
   clics al sitio y solicitudes de dirección de los últimos 28 días.

> Esta sección tambien esta oculta de la interfaz por ahora (pediste
> quitarla hasta resolver el tema de cuota). El backend sigue intacto en
> `src/lib/providers/businessProfile.ts`.

### SEO Youtube

Usa la misma API key de arriba (necesita **"YouTube Data API v3"**
habilitada y en las restricciones de la key). Pestaña **"SEO Youtube"**
en cada proyecto:

1. Pega el canal como `@handle`, ID (`UC...`) o URL completa de YouTube.
2. **"Conectar canal"** trae suscriptores, vistas totales, número de
   videos, y los 10 videos más recientes con sus vistas.
3. **"Actualizar"** vuelve a consultar los mismos datos.

Usa `channels.list` + `playlistItems.list` (barato en cuota) en vez de
`search.list`, así que no se acerca al límite diario gratuito de 10,000
unidades ni con muchos proyectos conectados.

### Ecommerce (auditoría de catálogo Shopify)

No requiere ninguna API key ni credenciales — lee los endpoints públicos
`/products.json` y `/collections.json` que Shopify expone por defecto en
cualquier tienda, usando el dominio que ya tiene el proyecto (no hay que
volver a escribir la URL).

Pestaña **"Ecommerce"** → botón **"Analizar tienda"**:

- Cuenta productos y colecciones.
- Marca productos sin descripción, sin imágenes, con imágenes sin texto
  alternativo, o con títulos muy cortos (menos de 15 caracteres) — todas
  son oportunidades de SEO on-page típicas en catálogos grandes.
- Lista hasta 50 productos con problemas, con link directo a cada uno.

Si el dominio no es una tienda Shopify o el catálogo público está
desactivado, el análisis lo indica en vez de fallar en silencio.

### Planificación (ideas de keywords)

Usa tu cuenta de DataForSEO ya configurada — sin setup adicional. Pestaña
**"Planificacion"**: escribe una keyword semilla y te devuelve keywords
relacionadas con volumen de búsqueda mensual real, competencia y CPC, con
un botón para agregar cualquiera directo a Rankings.

### SEO IA

No es una fuente de datos nueva — consolida en una sola vista lo que ya
recolectas en Rankings: si tu dominio aparece en el AI Overview de Google
(detectado automáticamente en cada rastreo) y las veces que marcaste
manualmente que te mencionó ChatGPT/Perplexity para tus keywords de esos
motores.

### Competencia: detección de Shopify + tráfico estimado

Al agregar un competidor, se detecta automáticamente si su tienda es
Shopify (mismo método público que usamos para tu propio catálogo) y se
guarda el conteo de productos. El botón **"Analizar"** en cada
competidor trae además un estimado de tráfico orgánico y de pago vía
DataForSEO Labs (`domain_rank_overview`) — consume créditos de tu cuenta
de DataForSEO cada vez que lo usas.

> ⚠️ **Sobre "ventas de competidores"**: no lo construí porque no existe
> forma legítima de obtenerlo — ninguna herramienta (ni SEMrush, ni
> Ahrefs, ni nosotros) puede ver las ventas reales de una tienda que no es
> tuya; esos datos son privados del dueño. Lo que sí se puede, y ya está
> implementado, es un **estimado** de tráfico orgánico/pago basado en las
> keywords donde DataForSEO ya ve posicionado al competidor — el mismo
> tipo de estimado que muestran las herramientas de pago, no una cifra
> exacta.

### Panel: ventas y tráfico propio (organico, pago, directo, IA)

- **Tráfico por canal**: viene de tu conexión de Google Analytics (ya
  configurada arriba) — sesiones reales organicas, de pago, directas, de
  referencia, y un desglose de **tráfico de IA** (ChatGPT, Perplexity,
  Gemini, Copilot) que GA4 normalmente esconde dentro de "Referral".
- **Ventas**: dato real de tu propia tienda Shopify, no un estimado. Se
  conecta con **un clic** — el merchant no crea ni configura nada. Ver
  "Conectar Shopify (OAuth de un clic)" abajo para el setup único que
  hace el desarrollador.

### Conectar Shopify (OAuth de un clic)

Para que cualquier merchant conecte su tienda con un solo clic (sin crear
apps ni copiar tokens), **tú** (el desarrollador) necesitas registrar una
app de Shopify una sola vez:

1. Entra a [partners.shopify.com](https://partners.shopify.com) (crea una
   cuenta de Partner si no tienes) → **Apps** → **Create app** → **Create
   app manually**.
2. En **App setup**, configura la **Allowed redirection URL(s)**:
   `http://localhost:3000/api/shopify/callback` (ajusta el dominio en
   producción).
3. Copia el **Client ID** y **Client secret** a `.env.local`:

```
SHOPIFY_API_KEY="..."
SHOPIFY_API_SECRET="..."
SHOPIFY_REDIRECT_URI="http://localhost:3000/api/shopify/callback"
```

4. Reinicia `npm run dev`.

Con eso, el botón **"Conectar con Shopify"** en la pestaña Panel ya
funciona: detecta automáticamente el dominio `.myshopify.com` de la
tienda (leyendo el HTML público de tu sitio), redirige al merchant a la
pantalla de aprobación de Shopify, y guarda el token que Shopify entrega
— nunca le pedimos al merchant que copie o pegue nada. Si el
autodetectado falla (tema sin ese dato expuesto), se le pide solo el
`tu-tienda.myshopify.com`, que cualquier dueño de tienda puede ver en su
propio admin sin configurar nada.

> Nota: mientras la app esté en modo desarrollo/no publicada en el
> Partner Dashboard, solo las tiendas de desarrollo o las que tú invites
> como colaborador pueden autorizarla. Para usarla con clientes externos,
> hay que enviarla a revisión o usar "Custom distribution".

## Cómo funciona

- **Proyectos**: cada cliente/sitio es un proyecto con su dominio.
- **Competidores**: dominios adicionales que se comparan en cada keyword.
- **Keywords**: se agregan por proyecto, eligiendo motor (Google, Bing,
  ChatGPT, Perplexity), dispositivo, ubicación e idioma.
- **Rastreo automático**: para Google y Bing, el botón "Rastrear ahora" (o
  "Rastrear todo") llama a DataForSEO y guarda la posición real de tu
  dominio y de cada competidor, incluyendo si apareces mencionado en el
  AI Overview de Google cuando este aparece en el SERP.
- **Registro manual**: para motores sin proveedor automático todavía
  (ChatGPT, Perplexity, o si prefieres capturar datos de SEMrush/Ahrefs a
  mano), cada keyword tiene un botón "Registrar manual" para anotar la
  posición o si tu marca fue mencionada.
- **Historial**: cada check queda guardado, así que las gráficas muestran
  la evolución de posición en el tiempo por dominio.

## Extender con más proveedores

La lógica de rastreo vive en `src/lib/providers/`. Para sumar SEMrush o
Ahrefs con API key propia, crea un archivo nuevo ahí (p. ej.
`semrush.ts`) siguiendo el mismo patrón que `dataforseo.ts`, y engánchalo
en `src/lib/rankingCheck.ts`.

## Próximo paso planeado

Conectar Microsoft Clarity (vía MCP) para sumar mapas de calor y métricas
de comportamiento al mismo dashboard, por proyecto.
