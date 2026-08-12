import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/auth/context";
import { notionExchangeCode } from "@/lib/connectors/notion";
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
  const cookieName = oauthStateCookieName("notion");
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
    provider: "notion",
    userId: ctx.userId,
    orgId: ctx.orgId,
  })) {
    return fail("Connexion Notion interrompue ou invalide.");
  }

  try {
    await assertConnectorFlowAllowed(ctx.orgId);
    const redirectUri = publicUrl("/api/connectors/notion/callback");
    const creds = await notionExchangeCode(code, redirectUri);
    await storeConnection(ctx.orgId, ctx.userId, "notion", creds, {
      workspace_name: creds.workspace_name ?? null,
    });
  } catch {
    return fail("Échange de jetons Notion impossible. Réessayez.");
  }

  const res = NextResponse.redirect(publicUrl("/connecteurs/notion"));
  res.cookies.set(cookieName, "", clearCookie);
  return res;
}
