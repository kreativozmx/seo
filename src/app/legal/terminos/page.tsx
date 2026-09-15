import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de servicio — Shopify Audit",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-sm text-neutral-700 leading-relaxed">
      <Link href="/" className="text-neutral-400 hover:text-neutral-600 text-xs">
        &larr; Volver
      </Link>

      <h1 className="text-2xl font-semibold text-neutral-900 mt-4 mb-1">
        Términos de servicio
      </h1>
      <p className="text-neutral-400 text-xs mb-8">
        Última actualización: 14 de septiembre de 2026
      </p>

      <p className="mb-6">
        Estos términos regulan el uso de Shopify Audit, una herramienta de
        seguimiento de posiciones en buscadores (Google, Bing) e IA,
        analíticas y auditoría de sitios/tiendas en línea. Al usar Shopify Audit
        aceptas estos términos.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        1. Uso del servicio
      </h2>
      <p className="mb-4">
        Shopify Audit está pensada para que agencias, equipos de marketing o dueños
        de tiendas den seguimiento a la visibilidad de sitios que administran
        o tienen autorización para analizar. Al conectar una cuenta de Google
        Search Console, Google Analytics o un canal de YouTube, declaras que
        cuentas con los permisos necesarios sobre esa propiedad o cuenta.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        2. Cuentas y conexiones
      </h2>
      <p className="mb-4">
        El acceso a datos de Google se realiza mediante OAuth; nunca te
        pedimos tu contraseña de Google directamente. Puedes desconectar
        cualquier integración en cualquier momento desde el apartado
        &ldquo;Conexiones&rdquo;. Eres responsable de mantener la confidencialidad del
        acceso a tu cuenta de Shopify Audit.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        3. Datos y estimaciones
      </h2>
      <p className="mb-4">
        Algunas métricas mostradas (por ejemplo, tráfico o valor estimado de
        competidores, volumen de búsqueda) provienen de proveedores externos
        de datos de SEO y son estimaciones, no cifras exactas ni datos
        verificados por Google. Las sugerencias generadas por IA (por
        ejemplo, títulos y descripciones de YouTube) son propuestas
        automáticas y deben revisarse antes de publicarse.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        4. Disponibilidad del servicio
      </h2>
      <p className="mb-4">
        Hacemos esfuerzos razonables para mantener Shopify Audit disponible y con
        datos actualizados, pero el servicio se ofrece &ldquo;tal cual&rdquo;, sin
        garantías de disponibilidad ininterrumpida. Las integraciones con
        Google, YouTube y otros proveedores dependen de la disponibilidad de
        sus propias APIs.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        5. Límites de responsabilidad
      </h2>
      <p className="mb-4">
        Shopify Audit no se hace responsable de decisiones de negocio tomadas
        exclusivamente con base en las métricas o sugerencias mostradas en la
        plataforma. Las estimaciones de tráfico, competencia o resultados de
        IA deben usarse como apoyo, no como única fuente de verdad.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        6. Cambios a estos términos
      </h2>
      <p className="mb-4">
        Podemos actualizar estos términos ocasionalmente. Si el cambio es
        relevante, lo indicaremos en esta misma página junto con la fecha de
        actualización.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        7. Contacto
      </h2>
      <p>
        Dudas sobre estos términos:{" "}
        <a
          href="mailto:israel@kreativoz.com.mx"
          className="text-blue-600 hover:underline"
        >
          israel@kreativoz.com.mx
        </a>
        .
      </p>
    </div>
  );
}
