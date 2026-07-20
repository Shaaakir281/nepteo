import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getEditorContext } from "@/lib/connectors/common";
import { notionAuthUrl } from "@/lib/connectors/notion";

export async function GET(request: NextRequest) {
  const ctx = await getEditorContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));
  if (!ctx.canEdit) {
    return NextResponse.redirect(
      new URL(`/connecteurs?error=${encodeURIComponent("Rôle insuffisant.")}`, request.url),
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
