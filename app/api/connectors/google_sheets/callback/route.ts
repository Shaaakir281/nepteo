import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/connectors/common";
import { googleExchangeCode } from "@/lib/connectors/google-sheets";
import { storeConnection } from "@/lib/connectors/store";

export async function GET(request: NextRequest) {
  const fail = (msg: string) =>
    NextResponse.redirect(
      new URL(`/connecteurs?error=${encodeURIComponent(msg)}`, request.url),
    );

  const ctx = await getEditorContext();
  if (!ctx?.canEdit) return fail("Session ou rôle invalide.");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("oauth_state_google")?.value;
  if (!code || !state || state !== cookieState) {
    return fail("Connexion Google interrompue ou invalide.");
  }

  try {
    const redirectUri = new URL(
      "/api/connectors/google_sheets/callback",
      request.url,
    ).toString();
    const creds = await googleExchangeCode(code, redirectUri);
    await storeConnection(ctx.orgId, ctx.userId, "google_sheets", creds);
  } catch {
    return fail("Échange de jetons Google impossible. Réessayez.");
  }

  const res = NextResponse.redirect(
    new URL("/connecteurs/google_sheets", request.url),
  );
  res.cookies.delete("oauth_state_google");
  return res;
}
