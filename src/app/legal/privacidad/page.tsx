import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — Shopify Audit",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-sm text-neutral-700 leading-relaxed">
      <Link href="/" className="text-neutral-400 hover:text-neutral-600 text-xs">
        &larr; Volver
      </Link>

      <h1 className="text-2xl font-semibold text-neutral-900 mt-4 mb-1">
        Política de privacidad
      </h1>
      <p className="text-neutral-400 text-xs mb-8">
        Última actualización: 14 de septiembre de 2026
      </p>

      <p className="mb-6">
        Shopify Audit ("nosotros", "la aplicación") es una herramienta de seguimiento
        de SEO y visibilidad en buscadores para tiendas y sitios web. Esta
        política explica qué datos recopilamos, para qué los usamos y cómo los
        protegemos cuando conectas tu cuenta de Google u otros servicios a
        Shopify Audit.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        1. Qué datos recopilamos
      </h2>
      <ul className="list-disc pl-5 space-y-1.5 mb-4">
        <li>
          <strong>Datos del proyecto:</strong> nombre y dominio del sitio que
          configuras para rastrear, y las palabras clave que agregas.
        </li>
        <li>
          <strong>Datos de Google Search Console</strong> (si conectas tu
          cuenta): clics, impresiones, posición promedio y consultas de
          búsqueda de las propiedades que tú autorizas explícitamente.
        </li>
        <li>
          <strong>Datos de Google Analytics 4</strong> (si conectas tu
          cuenta): sesiones, usuarios, conversiones, ingresos, páginas más
          visitadas y fuentes de tráfico de la propiedad que autorizas.
        </li>
        <li>
          <strong>Datos públicos de YouTube</strong> (si vinculas un canal):
          estadísticas y videos públicos del canal, usados solo para generar
          sugerencias de optimización.
        </li>
        <li>
          <strong>Tokens de acceso OAuth:</strong> cuando autorizas una
          conexión con Google, almacenamos un token de actualización
          ("refresh token") cifrado en tránsito, únicamente para poder
          refrescar los datos anteriores sin pedirte iniciar sesión cada vez.
        </li>
        <li>
          <strong>Datos técnicos del sitio:</strong> información pública del
          propio dominio que registras (por ejemplo, catálogo de productos,
          tecnologías detectadas, velocidad de carga), obtenida de fuentes
          públicas o de APIs de terceros que usamos para generar el reporte.
        </li>
      </ul>
      <p className="mb-4">
        No solicitamos ni almacenamos contraseñas de tus cuentas de Google,
        Shopify u otros servicios: la autenticación se realiza siempre
        mediante el flujo oficial de OAuth de cada proveedor.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        2. Para qué usamos tus datos
      </h2>
      <ul className="list-disc pl-5 space-y-1.5 mb-4">
        <li>Mostrarte el desempeño de tu sitio en buscadores e IA.</li>
        <li>Generar reportes, comparativas y recomendaciones de mejora.</li>
        <li>
          Generar sugerencias de contenido asistidas por IA (por ejemplo,
          títulos y descripciones de YouTube) usando un proveedor externo de
          modelos de lenguaje, al cual enviamos solo el texto necesario para
          esa sugerencia (título, descripción y palabras clave del video).
        </li>
        <li>Mantener actualizado el historial de posiciones de tus keywords.</li>
      </ul>
      <p className="mb-4">
        No vendemos tus datos ni los compartimos con terceros con fines
        publicitarios. Los datos de un proyecto solo son visibles para las
        personas con acceso a esa cuenta de Shopify Audit.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        3. Con quién compartimos datos
      </h2>
      <p className="mb-4">
        Usamos proveedores de infraestructura y APIs para operar la
        aplicación (por ejemplo, hosting en Vercel, base de datos en Neon,
        proveedores de datos de búsqueda y un proveedor de modelos de IA para
        las sugerencias de contenido). Estos proveedores procesan datos en
        nuestro nombre bajo sus propios términos de servicio y no los usan
        para fines propios.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        4. Cuánto tiempo conservamos los datos
      </h2>
      <p className="mb-4">
        Conservamos los datos de un proyecto mientras la cuenta y el proyecto
        permanezcan activos. Puedes solicitar la eliminación de un proyecto,
        sus keywords, historial de posiciones y conexiones asociadas en
        cualquier momento.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        5. Cómo revocar el acceso
      </h2>
      <p className="mb-4">
        Puedes desconectar Google Search Console, Google Analytics o YouTube
        desde el apartado "Conexiones" dentro de Shopify Audit, o revocando el
        acceso directamente desde la configuración de seguridad de tu cuenta
        de Google en{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline"
        >
          myaccount.google.com/permissions
        </a>
        . Al revocar el acceso, dejamos de poder actualizar esos datos, pero
        el historial ya guardado permanece hasta que lo elimines o elimines
        el proyecto.
      </p>

      <h2 className="text-base font-semibold text-neutral-900 mt-8 mb-2">
        6. Contacto
      </h2>
      <p>
        Si tienes preguntas sobre esta política o quieres solicitar la
        eliminación de tus datos, escríbenos a{" "}
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
