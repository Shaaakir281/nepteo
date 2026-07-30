import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getEditorContext } from "@/lib/auth/context";
import { googleAuthUrl } from "@/lib/connectors/google-sheets";
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
        `/entreprise?onglet=connecteurs&error=${encodeURIComponent("Connexion indisponible pendant la démonstration ou une opération en cours.")}`,
        request.url,
      ),
    );
  }
  const state = randomUUID();
  const redirectUri = new URL(
    "/api/connectors/google_sheets/callback",
    request.url,
  ).toString();
  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  res.cookies.set("oauth_state_google", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
