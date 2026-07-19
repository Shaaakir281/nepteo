"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
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
        ? "Email non confirmé — clique le lien reçu par mail avant de te connecter."
        : "Identifiants incorrects.",
    );
  }
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

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    fail(
      "/signup",
      error.code === "user_already_exists"
        ? "Un compte existe déjà avec cet email — connecte-toi plutôt."
        : "Création du compte impossible. Réessaie dans un instant.",
    );
  }
  redirect(
    `/signup?message=${encodeURIComponent("Compte créé — vérifie ta boîte mail pour confirmer ton adresse.")}`,
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
