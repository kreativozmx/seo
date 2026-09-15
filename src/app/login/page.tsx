import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión — Shopify Audit",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-10 items-center">
        <div className="max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={40} height={40} className="mb-3" />
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-3">
            Shopify Audit
          </h1>
          <p className="text-neutral-600 text-base leading-relaxed mb-6">
            ¿Tienes una tienda en Shopify? Esta herramienta te muestra, en un
            solo lugar, qué tan bien te está yendo en Google y qué tanto te
            falta para mejorar.
          </p>
          <ul className="flex flex-col gap-3 text-sm text-neutral-600">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-50 text-[#1A73E8] flex items-center justify-center text-[11px] font-semibold">
                ✓
              </span>
              Rastrea en qué posición aparece tu tienda para las palabras
              clave que le importan a tu negocio, y cómo te comparas contra
              tu competencia.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-50 text-[#1A73E8] flex items-center justify-center text-[11px] font-semibold">
                ✓
              </span>
              Una auditoría de 50 puntos hecha para tiendas Shopify —
              catálogo, velocidad, SEO técnico y más — con lo que ya se
              cumple marcado automáticamente.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-50 text-[#1A73E8] flex items-center justify-center text-[11px] font-semibold">
                ✓
              </span>
              Conecta Search Console, Analytics y tu Admin de Shopify para
              ver tráfico y ventas reales, no solo estimaciones.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-50 text-[#1A73E8] flex items-center justify-center text-[11px] font-semibold">
                ✓
              </span>
              Comparte el avance con tu equipo o tu cliente con un link de
              solo lectura, sin que necesiten cuenta ni contraseña.
            </li>
          </ul>
        </div>

        <div className="w-full max-w-sm justify-self-center md:justify-self-end">
          <p className="text-neutral-500 text-sm text-center mb-4">
            Inicia sesión para continuar
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
