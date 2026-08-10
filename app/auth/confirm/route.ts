import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { buildPublicAppRedirectUrl } from "@/lib/auth/confirmation-url";
import { createClient } from "@/lib/supabase/server";

/** Cible du lien de confirmation email envoyé par Supabase. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const publicUrlInput = {
    appUrl: process.env.APP_URL,
    requestOrigin: request.nextUrl.origin,
    isProduction: process.env.NODE_ENV === "production",
  };
  try {
    buildPublicAppRedirectUrl("/", publicUrlInput);
  } catch {
    return NextResponse.json(
      { error: "La confirmation est momentanément indisponible." },
      { status: 503 },
    );
  }

  const redirectTo = (path: string) =>
    NextResponse.redirect(buildPublicAppRedirectUrl(path, publicUrlInput));

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return redirectTo("/");
    }
  } else if (code) {
    // Flux PKCE : Supabase confirme l'email côté serveur puis redirige
    // avec un code à échanger contre une session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTo("/");
    }
  }

  return redirectTo(
    `/login?error=${encodeURIComponent("Lien de confirmation invalide ou expiré.")}`,
  );
}
