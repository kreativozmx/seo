import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Footer from "@/components/Footer";
import "./globals.css";

// M3's default typeface. Loaded via next/font/google so it's self-hosted
// (no external request) and exposed as --font-roboto for Tailwind's
// fontFamily.sans (see tailwind.config.ts).
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
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
        className={`${roboto.variable} font-sans antialiased bg-surface text-on-surface min-h-screen flex flex-col`}
      >
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
