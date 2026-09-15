import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditShopifyStore } from "@/lib/providers/shopify";
import { auditWooCommerceStore } from "@/lib/providers/woocommerce";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Try Shopify's public catalog first, then WooCommerce's Store API.
  // Whichever platform this turns out to be, the same summary shape gets
  // saved so the UI doesn't need to care which one it was.
  let shopifyError = "";
  try {
    const audit = await auditShopifyStore(project.domain);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        ecommercePlatform: "shopify",
        ecommerceIsShopify: true,
        ecommerceProductCount: audit.productCount,
        ecommerceProductCountIsMin: audit.productCountIsMin,
        ecommerceCollectionCount: audit.collectionCount,
        ecommerceCollectionCountIsMin: audit.collectionCountIsMin,
        ecommerceMissingDescCount: audit.missingDescCount,
        ecommerceMissingImageCount: audit.missingImageCount,
        ecommerceMissingAltCount: audit.missingAltCount,
        ecommerceThinTitleCount: audit.thinTitleCount,
        ecommerceFlaggedJson: JSON.stringify(audit.flagged),
        ecommercePriceMin: audit.priceMin,
        ecommercePriceMax: audit.priceMax,
        ecommerceAvgPrice: audit.avgPrice,
        ecommerceTotalVariants: audit.totalVariants,
        ecommerceTopVendorsJson: JSON.stringify(audit.topVendors),
        ecommerceTopTypesJson: JSON.stringify(audit.topProductTypes),
        ecommerceTopTagsJson: JSON.stringify(audit.topTags),
        ecommerceTopSellingJson: JSON.stringify(audit.topSelling),
        ecommerceNewestProductAt: audit.newestProductAt ? new Date(audit.newestProductAt) : null,
        ecommerceCheckedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, platform: "shopify", productCount: audit.productCount });
  } catch (err) {
    // not Shopify (or catalog is private) — try WooCommerce next, but keep
    // the reason so we can show it if WooCommerce fails too.
    shopifyError = err instanceof Error ? err.message : "Error desconocido";
  }

  try {
    const audit = await auditWooCommerceStore(project.domain);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        ecommercePlatform: "woocommerce",
        ecommerceIsShopify: false,
        ecommerceProductCount: audit.productCount,
        ecommerceProductCountIsMin: false,
        ecommerceCollectionCount: audit.topCategories.length,
        ecommerceCollectionCountIsMin: false,
        ecommerceMissingDescCount: audit.missingDescCount,
        ecommerceMissingImageCount: audit.missingImageCount,
        ecommerceMissingAltCount: audit.missingAltCount,
        ecommerceThinTitleCount: null,
        ecommerceFlaggedJson: JSON.stringify(audit.flagged),
        ecommercePriceMin: audit.priceMin,
        ecommercePriceMax: audit.priceMax,
        ecommerceAvgPrice: audit.avgPrice,
        ecommerceTotalVariants: null,
        ecommerceTopVendorsJson: null,
        ecommerceTopTypesJson: JSON.stringify(audit.topCategories),
        ecommerceTopTagsJson: null,
        ecommerceTopSellingJson: null,
        ecommerceNewestProductAt: null,
        ecommerceCheckedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, platform: "woocommerce", productCount: audit.productCount });
  } catch (err) {
    const wooError = err instanceof Error ? err.message : "Error desconocido";
    const bothMissing = shopifyError.includes("404") && wooError.includes("404");
    const hint = bothMissing
      ? " Un 404 en ambos suele significar que este dominio simplemente no corre Shopify ni WooCommerce (por ejemplo, una tienda armada a la medida, un storefront headless, u otra plataforma como Tiendanube/VTEX/Magento) — no es un bloqueo que podamos evitar desde aqui."
      : "";
    return NextResponse.json(
      {
        error: `No pudimos leer un catalogo publico de Shopify ni de WooCommerce en este dominio.${hint} Shopify: ${shopifyError} · WooCommerce: ${wooError}`,
      },
      { status: 500 }
    );
  }
}
