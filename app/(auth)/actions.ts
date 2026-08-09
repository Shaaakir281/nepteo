"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildConfirmationRedirectUrl } from "@/lib/auth/confirmation-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Purge le cache du routeur client sur toute l'application.
 *
 * Indispensable au changement de session : sans ça, l'arbre du cockpit reste en
 * cache après une déconnexion, la requête RSC suivante se fait rediriger vers
 * /login par `proxy.ts`, et le routeur se retrouve avec un arbre nul
 * (« Cannot use 'in' operator to search for 'headCacheNode' in null »).
 */
function clearRouterCache(): void {
  revalidatePath("/", "layout");
}

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const emailSchema = z.object({ email: z.email() });

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function confirmationRedirectUrl(): Promise<string> {
  try {
    return buildConfirmationRedirectUrl({
      appUrl: process.env.APP_URL,
      requestOrigin: (await headers()).get("origin"),
      isProduction: process.env.NODE_ENV === "production",
    });
  } catch {
    fail(
      "/signup",
      "L'inscription est momentanément indisponible. Préviens l'équipe Nepteo.",
    );
  }
}

function emailDeliveryError(code: string | undefined): string {
  if (code === "email_address_not_authorized") {
    return "L'envoi des emails de confirmation n'est pas encore disponible. Préviens l'équipe Nepteo.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Trop de demandes rapprochées. Attends quelques minutes avant de renvoyer le lien.";
  }
  return "L'email de confirmation n'a pas pu être envoyé. Réessaie dans un instant.";
}

function signupError(code: string | undefined): string {
  if (code === "user_already_exists" || code === "email_exists") {
    return "Un compte existe peut-être déjà avec cet email. Connecte-toi ou renvoie le lien de confirmation ci-dessous.";
  }
  if (code === "weak_password") {
    return "Ce mot de passe est trop faible. Choisis un mot de passe plus long et difficile à deviner.";
  }
  if (code === "email_provider_disabled" || code === "signup_disabled") {
    return "Les nouvelles inscriptions sont momentanément désactivées.";
  }
  return emailDeliveryError(code);
}

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    fail("/login", "Email invalide ou mot de passe trop court (8 caractères minimum).");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    fail(
      "/login",
      error.code === "email_not_confirmed"
        ? "Email non confirmé — clique le lien reçu ou utilise « Renvoyer le lien » sur la page Créer un compte."
        : "Identifiants incorrects.",
    );
  }
  // Nouvelle session : on ne veut hériter d'aucune page mise en cache pour le
  // compte précédent (et l'organisation précédente).
  clearRouterCache();
  redirect("/");
}

export async function signup(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    fail("/signup", "Email invalide ou mot de passe trop court (8 caractères minimum).");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: await confirmationRedirectUrl() },
  });
  if (error) {
    fail("/signup", signupError(error.code));
  }
  redirect(
    `/signup?message=${encodeURIComponent("Compte créé — vérifie ta boîte mail pour confirmer ton adresse.")}`,
  );
}

export async function resendConfirmation(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    fail("/signup", "Saisis une adresse email valide pour renvoyer le lien.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await confirmationRedirectUrl() },
  });
  if (error) fail("/signup", emailDeliveryError(error.code));

  redirect(
    `/signup?message=${encodeURIComponent(
      "Si cette adresse correspond à un compte non confirmé, un nouveau lien vient d'être demandé. Vérifie aussi les spams.",
    )}#resend-confirmation`,
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  clearRouterCache();
  redirect("/login");
}
