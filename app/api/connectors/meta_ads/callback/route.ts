import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/auth/context";
import {
  META_ADS_SCOPES,
  metaExchangeCode,
  verifyMetaReadScope,
} from "@/lib/connectors/meta-ads";
import {
  assertConnectorFlowAllowed,
  storeConnection,
} from "@/lib/connectors/store";
import {
  buildConnectorPublicUrl,
  oauthStateCookieName,
  oauthStateCookieOptions,
  verifyOAuthState,
} from "@/lib/connectors/oauth-security";

export async function GET(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const publicUrl = (path: string) =>
    buildConnectorPublicUrl(path, {
      appUrl: process.env.APP_URL,
      requestUrl: request.url,
      isProduction,
    });
  const cookieName = oauthStateCookieName("meta_ads");
  const clearCookie = { ...oauthStateCookieOptions(isProduction), maxAge: 0 };
  const fail = (message: string) => {
    const response = NextResponse.redirect(
      publicUrl(`/entreprise?onglet=connecteurs&error=${encodeURIComponent(message)}`),
    );
    response.cookies.set(cookieName, "", clearCookie);
    return response;
  };
  const ctx = await getEditorContext();
  if (!ctx?.canEdit) return fail("Session ou rôle invalide.");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(cookieName)?.value;
  if (!code || !verifyOAuthState(state, cookieState, {
    provider: "meta_ads",
    userId: ctx.userId,
    orgId: ctx.orgId,
  })) {
    return fail("Connexion Meta Ads interrompue ou invalide.");
  }

  try {
    await assertConnectorFlowAllowed(ctx.orgId);
    const redirectUri = publicUrl("/api/connectors/meta_ads/callback");
    const credentials = await metaExchangeCode(code, redirectUri);
    if (!(await verifyMetaReadScope(credentials.access_token))) {
      return fail("Le droit Meta Ads requis n'a pas été accordé.");
    }
    await storeConnection(
      ctx.orgId,
      ctx.userId,
      "meta_ads",
      credentials,
      {},
      META_ADS_SCOPES,
    );
  } catch {
    return fail("Connexion Meta Ads impossible. Réessayez après avoir vérifié l'accès.");
  }

  const response = NextResponse.redirect(publicUrl("/connecteurs/meta_ads"));
  response.cookies.set(cookieName, "", clearCookie);
  return response;
}
