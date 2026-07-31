import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getEditorContext } from "@/lib/auth/context";
import { notionAuthUrl } from "@/lib/connectors/notion";
import { assertConnectorFlowAllowed } from "@/lib/connectors/store";

export async function GET(request: NextRequest) {
  const ctx = await getEditorContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));
  if (!ctx.canEdit) {
    return NextResponse.redirect(
      new URL(
        `/entreprise?onglet=connecteurs&error=${encodeURIComponent("Rôle insuffisant.")}`,
        request.url,
      ),
    );
  }
  try {
    await assertConnectorFlowAllowed(ctx.orgId);
  } catch {
    return NextResponse.redirect(
      new URL(
        `/entreprise?onglet=connecteurs&error=${encodeURIComponent("Connexion indisponible tant que le scénario Nepteo ou une autre opération est en cours.")}`,
        request.url,
      ),
    );
  }
  const state = randomUUID();
  const redirectUri = new URL(
    "/api/connectors/notion/callback",
    request.url,
  ).toString();
  const res = NextResponse.redirect(notionAuthUrl(redirectUri, state));
  res.cookies.set("oauth_state_notion", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
