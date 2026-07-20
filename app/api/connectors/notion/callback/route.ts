import { NextResponse, type NextRequest } from "next/server";
import { getEditorContext } from "@/lib/connectors/common";
import { notionExchangeCode } from "@/lib/connectors/notion";
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
  const cookieState = request.cookies.get("oauth_state_notion")?.value;
  if (!code || !state || state !== cookieState) {
    return fail("Connexion Notion interrompue ou invalide.");
  }

  try {
    const redirectUri = new URL(
      "/api/connectors/notion/callback",
      request.url,
    ).toString();
    const creds = await notionExchangeCode(code, redirectUri);
    await storeConnection(ctx.orgId, ctx.userId, "notion", creds, {
      workspace_name: creds.workspace_name ?? null,
    });
  } catch {
    return fail("Échange de jetons Notion impossible. Réessayez.");
  }

  const res = NextResponse.redirect(
    new URL("/connecteurs/notion", request.url),
  );
  res.cookies.delete("oauth_state_notion");
  return res;
}
