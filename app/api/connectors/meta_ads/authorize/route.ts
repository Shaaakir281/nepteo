import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/auth/context";
import { metaAuthUrl } from "@/lib/connectors/meta-ads";
import { assertConnectorFlowAllowed } from "@/lib/connectors/store";

export async function GET(request: NextRequest) {
  const ctx = await getEditorContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));
  if (!ctx.canEdit) {
    return NextResponse.redirect(
      new URL("/entreprise?onglet=connecteurs&error=R%C3%B4le%20insuffisant.", request.url),
    );
  }
  try {
    await assertConnectorFlowAllowed(ctx.orgId);
    const state = randomUUID();
    const redirectUri = new URL("/api/connectors/meta_ads/callback", request.url).toString();
    const response = NextResponse.redirect(metaAuthUrl(redirectUri, state));
    response.cookies.set("oauth_state_meta_ads", state, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL(
        "/entreprise?onglet=connecteurs&error=Connexion%20Meta%20Ads%20indisponible.%20V%C3%A9rifiez%20la%20configuration%20ou%20retirez%20le%20sc%C3%A9nario%20Nepteo.",
        request.url,
      ),
    );
  }
}
