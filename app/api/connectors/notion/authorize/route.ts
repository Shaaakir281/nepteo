import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/auth/context";
import { notionAuthUrl } from "@/lib/connectors/notion";
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
      publicUrl(
        `/entreprise?onglet=connecteurs&error=${encodeURIComponent("Rôle insuffisant.")}`,
      ),
    );
  }
  try {
    await assertConnectorFlowAllowed(ctx.orgId);
  } catch {
    return NextResponse.redirect(
      publicUrl(
        `/entreprise?onglet=connecteurs&error=${encodeURIComponent("Connexion indisponible tant que le scénario Nepteo ou une autre opération est en cours.")}`,
      ),
    );
  }
  const state = createOAuthState({
    provider: "notion",
    userId: ctx.userId,
    orgId: ctx.orgId,
  });
  const redirectUri = publicUrl("/api/connectors/notion/callback");
  const res = NextResponse.redirect(notionAuthUrl(redirectUri, state));
  res.cookies.set(
    oauthStateCookieName("notion"),
    state,
    oauthStateCookieOptions(isProduction),
  );
  return res;
}
