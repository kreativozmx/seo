import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOAuthClient, decodeState } from "@/lib/googleAuth";
import { listVerifiedSites, matchSiteUrl } from "@/lib/providers/gsc";

const ERROR_PARAM: Record<string, string> = {
  gsc: "gscError",
  ga: "gaError",
  gbp: "gbpError",
};

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (!stateParam) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  const { projectId, product } = decodeState(stateParam);
  const errorKey = ERROR_PARAM[product] ?? "gscError";

  const redirectTo = (query: string) =>
    NextResponse.redirect(new URL(`/projects/${projectId}?${query}`, req.url));

  if (errorParam) {
    return redirectTo(`${errorKey}=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return redirectTo(
      `${errorKey}=${encodeURIComponent("No se recibio el codigo de autorizacion")}`
    );
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Proyecto no encontrado");

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google no devolvio un refresh token. Revoca el acceso en myaccount.google.com/permissions e intenta de nuevo."
      );
    }
    client.setCredentials(tokens);

    if (product === "ga") {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gaRefreshToken: tokens.refresh_token,
          gaConnectedAt: new Date(),
        },
      });
      return redirectTo("gaConnected=1");
    }

    if (product === "gbp") {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gbpRefreshToken: tokens.refresh_token,
          gbpConnectedAt: new Date(),
        },
      });
      return redirectTo("gbpConnected=1");
    }

    // product === "gsc"
    const sites = await listVerifiedSites(client);
    const siteUrl = matchSiteUrl(sites, project.domain);
    if (!siteUrl) {
      throw new Error(
        `No se encontro una propiedad verificada en Search Console para "${project.domain}". Verifica el dominio en Search Console primero.`
      );
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        gscRefreshToken: tokens.refresh_token,
        gscSiteUrl: siteUrl,
        gscConnectedAt: new Date(),
      },
    });

    return redirectTo("gscConnected=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return redirectTo(`${errorKey}=${encodeURIComponent(message)}`);
  }
}
