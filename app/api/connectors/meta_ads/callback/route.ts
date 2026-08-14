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
import { createAdminClient } from "@/lib/supabase/admin";

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
      publicUrl(`/connecteurs/meta_ads?error=${encodeURIComponent(message)}`),
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
  if (!verifyOAuthState(state, cookieState, {
    provider: "meta_ads",
    userId: ctx.userId,
    orgId: ctx.orgId,
  })) {
    return fail("Connexion Meta Ads interrompue ou invalide.");
  }
  if (!code) {
    return fail(
      "Meta n’a pas autorisé la connexion. Si votre compte n’est pas encore testeur, demandez d’abord l’accès pilote dans Nepteo.",
    );
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

  // Le suivi pilote est secondaire : un incident ici ne doit pas invalider
  // le consentement et les credentials déjà stockés avec succès.
  try {
    const { error } = await createAdminClient().rpc(
      "mark_meta_ads_pilot_access_connected",
      {
      p_organization_id: ctx.orgId,
      p_actor_id: ctx.userId,
      },
    );
    if (error) throw error;
  } catch {
    // `connector_authorized` reste la preuve append-only de la connexion.
  }

  const response = NextResponse.redirect(publicUrl("/connecteurs/meta_ads"));
  response.cookies.set(cookieName, "", clearCookie);
  return response;
}
