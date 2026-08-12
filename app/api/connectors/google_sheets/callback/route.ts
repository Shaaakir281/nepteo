import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/auth/context";
import { googleExchangeCode } from "@/lib/connectors/google-sheets";
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
  const cookieName = oauthStateCookieName("google_sheets");
  const clearCookie = { ...oauthStateCookieOptions(isProduction), maxAge: 0 };
  const fail = (msg: string) => {
    const response = NextResponse.redirect(
      publicUrl(`/entreprise?onglet=connecteurs&error=${encodeURIComponent(msg)}`),
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
    provider: "google_sheets",
    userId: ctx.userId,
    orgId: ctx.orgId,
  })) {
    return fail("Connexion Google interrompue ou invalide.");
  }

  try {
    await assertConnectorFlowAllowed(ctx.orgId);
    const redirectUri = publicUrl("/api/connectors/google_sheets/callback");
    const creds = await googleExchangeCode(code, redirectUri);
    await storeConnection(ctx.orgId, ctx.userId, "google_sheets", creds, {}, [
      "spreadsheets.readonly",
    ]);
  } catch {
    return fail("Échange de jetons Google impossible. Réessayez.");
  }

  const res = NextResponse.redirect(publicUrl("/connecteurs/google_sheets"));
  res.cookies.set(cookieName, "", clearCookie);
  return res;
}
