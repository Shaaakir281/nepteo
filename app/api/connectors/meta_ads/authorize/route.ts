import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/auth/context";
import { metaAuthUrl } from "@/lib/connectors/meta-ads";
import { assertConnectorFlowAllowed } from "@/lib/connectors/store";
import {
  buildConnectorPublicUrl,
  createOAuthState,
  oauthStateCookieName,
  oauthStateCookieOptions,
} from "@/lib/connectors/oauth-security";

export async function GET(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const publicUrl = (path: string) =>
    buildConnectorPublicUrl(path, {
      appUrl: process.env.APP_URL,
      requestUrl: request.url,
      isProduction,
    });
  const ctx = await getEditorContext();
  if (!ctx) return NextResponse.redirect(publicUrl("/login"));
  if (!ctx.canEdit) {
    return NextResponse.redirect(
      publicUrl("/entreprise?onglet=connecteurs&error=R%C3%B4le%20insuffisant."),
    );
  }
  try {
    await assertConnectorFlowAllowed(ctx.orgId);
    const state = createOAuthState({
      provider: "meta_ads",
      userId: ctx.userId,
      orgId: ctx.orgId,
    });
    const redirectUri = publicUrl("/api/connectors/meta_ads/callback");
    const response = NextResponse.redirect(metaAuthUrl(redirectUri, state));
    response.cookies.set(
      oauthStateCookieName("meta_ads"),
      state,
      oauthStateCookieOptions(isProduction),
    );
    return response;
  } catch {
    return NextResponse.redirect(
      publicUrl(
        "/entreprise?onglet=connecteurs&error=Connexion%20Meta%20Ads%20indisponible.%20V%C3%A9rifiez%20la%20configuration%20ou%20retirez%20le%20sc%C3%A9nario%20Nepteo.",
      ),
    );
  }
}
