// Wappalyzer-style technology detection — fetches the homepage HTML and
// response headers and matches them against known signatures for common
// platforms, analytics/marketing tools, and Shopify-ecosystem apps. Free,
// no credentials, no third-party API.

export interface DetectedTech {
  name: string;
  category: string;
  icon: string;
  url: string;
}

interface Signature {
  name: string;
  categories: string[];
  icon: string;
  url: string;
  test: (html: string, headers: Headers) => boolean;
}

function headerIncludes(headers: Headers, name: string, needle: string) {
  const value = headers.get(name);
  return Boolean(value && value.toLowerCase().includes(needle.toLowerCase()));
}

const SIGNATURES: Signature[] = [
  // Platform / CMS
  {
    name: "Shopify",
    categories: ["Tienda Web"],
    icon: "🛍️",
    url: "https://shopify.com",
    test: (html, headers) =>
      /cdn\.shopify\.com/i.test(html) ||
      /Shopify\.theme/i.test(html) ||
      Boolean(headers.get("x-shopid")),
  },
  { name: "WordPress", categories: ["CMS"], icon: "📝", url: "https://wordpress.org", test: (html) => /wp-content|wp-includes/i.test(html) },
  { name: "WooCommerce", categories: ["Tienda Web"], icon: "🛒", url: "https://woocommerce.com", test: (html) => /woocommerce/i.test(html) },
  { name: "Wix", categories: ["CMS"], icon: "🅆", url: "https://wix.com", test: (html) => /wix\.com|wixstatic\.com/i.test(html) },
  { name: "Squarespace", categories: ["CMS"], icon: "⬛", url: "https://squarespace.com", test: (html) => /squarespace\.com/i.test(html) },
  { name: "BigCommerce", categories: ["Tienda Web"], icon: "🏬", url: "https://bigcommerce.com", test: (html) => /bigcommerce\.com/i.test(html) },
  { name: "Magento", categories: ["Tienda Web"], icon: "🅼", url: "https://magento.com", test: (html) => /Magento|mage\/cookies/i.test(html) },
  {
    name: "Next.js",
    categories: ["Framework Web", "Servidor Web", "Generador de sitios estaticos"],
    icon: "▲",
    url: "https://nextjs.org",
    test: (html) => /__NEXT_DATA__/i.test(html),
  },
  { name: "React", categories: ["Framework JavaScript"], icon: "⚛️", url: "https://react.dev", test: (html) => /data-reactroot|react-dom/i.test(html) },
  { name: "Vue.js", categories: ["Framework JavaScript"], icon: "🟢", url: "https://vuejs.org", test: (html) => /data-v-app|__VUE__/i.test(html) },

  // Analytics / tag managers
  { name: "Google Analytics", categories: ["Analitica"], icon: "📊", url: "https://analytics.google.com", test: (html) => /gtag\(['"]config['"],\s*['"]G-/i.test(html) },
  { name: "Google Tag Manager", categories: ["Analitica"], icon: "🏷️", url: "https://tagmanager.google.com", test: (html) => /googletagmanager\.com\/gtm\.js/i.test(html) },
  { name: "Meta Pixel", categories: ["Analitica / Ads"], icon: "📘", url: "https://business.facebook.com", test: (html) => /connect\.facebook\.net\/.*fbevents\.js|fbq\(/i.test(html) },
  { name: "TikTok Pixel", categories: ["Analitica / Ads"], icon: "🎵", url: "https://ads.tiktok.com", test: (html) => /analytics\.tiktok\.com/i.test(html) },
  { name: "Pinterest Tag", categories: ["Analitica / Ads"], icon: "📌", url: "https://ads.pinterest.com", test: (html) => /pintrk\(/i.test(html) },
  { name: "Hotjar", categories: ["Analitica de comportamiento"], icon: "🔥", url: "https://hotjar.com", test: (html) => /static\.hotjar\.com/i.test(html) },
  { name: "Microsoft Clarity", categories: ["Analitica de comportamiento"], icon: "🔎", url: "https://clarity.microsoft.com", test: (html) => /clarity\.ms/i.test(html) },

  // Email / marketing automation
  { name: "Klaviyo", categories: ["Email marketing"], icon: "✉️", url: "https://klaviyo.com", test: (html) => /klaviyo\.com|_learnq/i.test(html) },
  { name: "Mailchimp", categories: ["Email marketing"], icon: "🐵", url: "https://mailchimp.com", test: (html) => /list-manage\.com|mailchimp/i.test(html) },
  { name: "Omnisend", categories: ["Email marketing"], icon: "📧", url: "https://omnisend.com", test: (html) => /omnisend/i.test(html) },

  // Reviews
  { name: "Yotpo", categories: ["Reseñas"], icon: "⭐", url: "https://yotpo.com", test: (html) => /yotpo\.com/i.test(html) },
  { name: "Judge.me", categories: ["Reseñas"], icon: "⭐", url: "https://judge.me", test: (html) => /judge\.me/i.test(html) },
  { name: "Loox", categories: ["Reseñas"], icon: "⭐", url: "https://loox.io", test: (html) => /loox\.(io|app)/i.test(html) },
  { name: "Stamped.io", categories: ["Reseñas"], icon: "⭐", url: "https://stamped.io", test: (html) => /stamped\.io/i.test(html) },

  // Chat / support
  { name: "Tidio", categories: ["Chat / soporte"], icon: "💬", url: "https://tidio.com", test: (html) => /tidio/i.test(html) },
  { name: "Intercom", categories: ["Chat / soporte"], icon: "💬", url: "https://intercom.com", test: (html) => /widget\.intercom\.io/i.test(html) },
  { name: "Zendesk", categories: ["Chat / soporte"], icon: "💬", url: "https://zendesk.com", test: (html) => /zdassets\.com|zendesk/i.test(html) },
  { name: "WhatsApp", categories: ["Chat / soporte"], icon: "💚", url: "https://whatsapp.com", test: (html) => /wa\.me|whatsapp/i.test(html) },

  // Page builders / apps (Shopify ecosystem)
  { name: "PageFly", categories: ["Page builder"], icon: "🧩", url: "https://pagefly.io", test: (html) => /pagefly/i.test(html) },
  { name: "GemPages", categories: ["Page builder"], icon: "💎", url: "https://gempages.net", test: (html) => /gempages/i.test(html) },
  { name: "Shogun", categories: ["Page builder"], icon: "🥋", url: "https://getshogun.com", test: (html) => /getshogun\.com/i.test(html) },
  { name: "Recharge", categories: ["Suscripciones"], icon: "🔁", url: "https://rechargepayments.com", test: (html) => /rechargeapps\.com|rechargepayments/i.test(html) },

  // Payments
  { name: "Shop Pay", categories: ["Pagos"], icon: "💳", url: "https://shop.app", test: (html) => /shop-pay|shopify_pay/i.test(html) },
  { name: "PayPal", categories: ["Pagos"], icon: "💳", url: "https://paypal.com", test: (html) => /paypal\.com\/sdk/i.test(html) },
  { name: "Klarna", categories: ["Pagos"], icon: "💳", url: "https://klarna.com", test: (html) => /klarna/i.test(html) },
  { name: "Afterpay", categories: ["Pagos"], icon: "💳", url: "https://afterpay.com", test: (html) => /afterpay/i.test(html) },

  // CDN / hosting
  { name: "Cloudflare", categories: ["CDN"], icon: "☁️", url: "https://cloudflare.com", test: (_html, headers) => headerIncludes(headers, "server", "cloudflare") || Boolean(headers.get("cf-ray")) },
  { name: "Vercel", categories: ["Servidor Web"], icon: "▲", url: "https://vercel.com", test: (_html, headers) => Boolean(headers.get("x-vercel-id")) },

  // JS libraries
  { name: "jQuery", categories: ["Libreria JS"], icon: "🔤", url: "https://jquery.com", test: (html) => /jquery(\.min)?\.js/i.test(html) },
];

export interface TechAudit {
  detected: DetectedTech[];
}

export async function detectTechnologies(domain: string): Promise<TechAudit> {
  const res = await fetch(`https://${domain}/`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopiseoBot/1.0)" },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`No se pudo leer el sitio (${res.status})`);
  }

  const html = await res.text();
  const detected: DetectedTech[] = [];

  for (const sig of SIGNATURES) {
    try {
      if (sig.test(html, res.headers)) {
        for (const category of sig.categories) {
          detected.push({ name: sig.name, category, icon: sig.icon, url: sig.url });
        }
      }
    } catch {
      // ignore a single bad signature test
    }
  }

  return { detected };
}
