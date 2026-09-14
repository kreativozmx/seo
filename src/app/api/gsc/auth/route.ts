import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthRedirect, GSC_SCOPE } from "@/lib/googleAuth";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const redirectUrl = buildGoogleAuthRedirect(
    req.url,
    projectId,
    "gsc",
    GSC_SCOPE,
    "gscError"
  );
  return NextResponse.redirect(redirectUrl);
}
