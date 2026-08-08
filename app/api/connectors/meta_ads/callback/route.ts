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

export async function GET(request: NextRequest) {
  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`/entreprise?onglet=connecteurs&error=${encodeURIComponent(message)}`, request.url),
    );
  const ctx = await getEditorContext();
  if (!ctx?.canEdit) return fail("Session ou rôle invalide.");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("oauth_state_meta_ads")?.value;
  if (!code || !state || state !== cookieState) {
    return fail("Connexion Meta Ads interrompue ou invalide.");
  }

  try {
    await assertConnectorFlowAllowed(ctx.orgId);
    const redirectUri = new URL("/api/connectors/meta_ads/callback", request.url).toString();
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

  const response = NextResponse.redirect(new URL("/connecteurs/meta_ads", request.url));
  response.cookies.delete("oauth_state_meta_ads");
  return response;
}
