import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Cible du lien de confirmation email envoyé par Supabase. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } else if (code) {
    // Flux PKCE : Supabase confirme l'email côté serveur puis redirige
    // avec un code à échanger contre une session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent("Lien de confirmation invalide ou expiré.")}`,
      request.url,
    ),
  );
}
