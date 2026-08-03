"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizePhilosophy } from "@/lib/memory";
import { researchConfigured } from "@/lib/research/provider";
import { resolveSingleMembership } from "@/lib/auth/membership-rules";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(80),
  activity: z.string().trim().max(300).optional(),
  onboardingPath: z.enum(["example", "real"]).default("real"),
  scenario: z.enum(["artisan", "agence", "ecommerce"]).optional(),
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
    onboardingPath: formData.get("onboarding_path") || "real",
    scenario: formData.get("scenario") || undefined,
  });
  if (
    !parsed.success ||
    (parsed.data.onboardingPath === "example" && !parsed.data.scenario)
  ) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Nom invalide (entre 2 et 80 caractères).")}`,
    );
  }

  const nextDestination =
    parsed.data.onboardingPath === "example"
      ? `/prise-en-main?depart=example&scenario=${parsed.data.scenario}`
      : researchConfigured()
        ? "/onboarding/identite"
        : "/prise-en-main?depart=real";

  // Écritures via service-role (RLS contournée) — toujours journalisées.
  const admin = createAdminClient();

  // Idempotence : si une organisation existe déjà pour cet utilisateur (double
  // soumission, retour arrière), on entre dans le cockpit au lieu d'en créer
  // une seconde.
  const { data: existingMemberships, error: existingMembershipError } =
    await admin
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("organization_id", { ascending: true })
      .limit(2);

  if (existingMembershipError) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Vérification impossible. Réessaie dans un instant.")}`,
    );
  }

  const existing = resolveSingleMembership(existingMemberships ?? []);
  if (existing) redirect(nextDestination);

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
    // Sans membership, l'organisation est orpheline et l'utilisateur resterait
    // bloqué sur l'onboarding à chaque tentative. On nettoie pour que réessayer
    // ait une chance d'aboutir.
    await admin.from("organizations").delete().eq("id", org.id);

    // Une double soumission strictement concurrente peut avoir créé le
    // membership dans l'autre requête entre le préflight et cet insert. La
    // contrainte 0013 protège l'intégrité ; on traite alors la requête perdante
    // comme idempotente au lieu d'afficher une fausse erreur.
    if (memberError.code === "23505") {
      const { data: concurrentMemberships, error: concurrentMembershipError } =
        await admin
          .from("memberships")
          .select("organization_id")
          .eq("user_id", user.id)
          .order("organization_id", { ascending: true })
          .limit(2);
      if (
        !concurrentMembershipError &&
        resolveSingleMembership(concurrentMemberships ?? [])
      ) {
        redirect(nextDestination);
      }
    }

    redirect(
      `/onboarding?error=${encodeURIComponent("Création impossible. Réessaie dans un instant.")}`,
    );
  }

  await admin.from("journal").insert({
    organization_id: org.id,
    event: "organization_created",
    actor: "user",
    actor_id: user.id,
    payload: {
      name: parsed.data.name,
      onboarding_path: parsed.data.onboardingPath,
    },
  });

  // Philosophie : champ facultatif du formulaire → section de mémoire.
  // Vide = aucune écriture. Un échec ici ne doit pas bloquer la création du
  // cockpit (l'utilisateur pourra toujours la saisir depuis /entreprise).
  const philosophy = normalizePhilosophy(formData.get("philosophy"));
  if (philosophy) {
    const { error: memError } = await admin.from("company_memory").upsert(
      {
        organization_id: org.id,
        section: "philosophie",
        content: { text: philosophy },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,section" },
    );
    if (!memError) {
      await admin.from("journal").insert({
        organization_id: org.id,
        event: "memory_updated",
        actor: "user",
        actor_id: user.id,
        payload: { section: "philosophie", source: "onboarding" },
      });
    }
  }

  // 2e écran, facultatif : l'agent propose une identité à partir du site.
  // Sans recherche web configurée, il n'aurait rien à proposer — on l'évite
  // plutôt que de montrer un écran qui ne peut pas aboutir.
  redirect(nextDestination);
}
