"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(80),
  activity: z.string().trim().max(300).optional(),
});

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    activity: formData.get("activity") || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Nom invalide (entre 2 et 80 caractères).")}`,
    );
  }

  // Écritures via service-role (RLS contournée) — toujours journalisées.
  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: parsed.data.name, activity: parsed.data.activity ?? null })
    .select("id")
    .single();
  if (orgError || !org) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Création impossible. Réessaie dans un instant.")}`,
    );
  }

  const { error: memberError } = await admin.from("memberships").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "admin",
  });
  if (memberError) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Création impossible. Réessaie dans un instant.")}`,
    );
  }

  await admin.from("journal").insert({
    organization_id: org.id,
    event: "organization_created",
    actor: "user",
    actor_id: user.id,
    payload: { name: parsed.data.name },
  });

  redirect("/");
}
