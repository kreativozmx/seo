import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-100 mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
        <p>&copy; {new Date().getFullYear()} Shopify Audit</p>
        <nav className="flex items-center gap-4">
          <Link href="/legal/privacidad" className="hover:text-neutral-600">
            Política de privacidad
          </Link>
          <Link href="/legal/terminos" className="hover:text-neutral-600">
            Términos de servicio
          </Link>
        </nav>
      </div>
    </footer>
  );
}
