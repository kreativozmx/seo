import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Footer from "@/components/Footer";
import { PresentationModeToggle } from "@/components/PresentationMode";
import "./globals.css";

// Linear/Vercel-style geometric sans. Loaded via next/font/google so it's
// self-hosted (no external request) and exposed as --font-inter for
// Tailwind's fontFamily.sans (see tailwind.config.ts).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Shopify Audit",
  description: "Seguimiento de posiciones en Google, Bing e IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} font-sans antialiased bg-surface text-on-surface min-h-screen flex flex-col`}
      >
        <div id="presentation-content" className="flex-1">{children}</div>
        <Footer />
        <PresentationModeToggle />
      </body>
    </html>
  );
}
