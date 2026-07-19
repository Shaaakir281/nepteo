"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findTool } from "@/lib/connectors";
import { EDIT_ROLES } from "@/lib/memory";

function fail(message: string): never {
  redirect(`/connecteurs?error=${encodeURIComponent(message)}`);
}

/**
 * Phase 1 : les connexions OAuth ne sont pas encore ouvertes.
 * « Connecter » enregistre la demande (visible par l'équipe) et la journalise —
 * le branchement réel arrivera connecteur par connecteur.
 */
export async function requestConnector(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  if (!EDIT_ROLES.includes(membership.role)) {
    fail("Votre rôle ne permet pas de gérer les connecteurs.");
  }

  const provider = String(formData.get("provider") ?? "");
  const tool = findTool(provider);
  if (!tool) fail("Connecteur inconnu.");

  const admin = createAdminClient();
  const { error } = await admin.from("connectors").upsert(
    {
      organization_id: membership.organization_id,
      type: tool.type,
      provider: tool.provider,
      status: "disconnected",
      config: { requested: true, requested_at: new Date().toISOString() },
    },
    { onConflict: "organization_id,provider" },
  );
  if (error) fail("Demande impossible. Réessayez dans un instant.");

  await admin.from("journal").insert({
    organization_id: membership.organization_id,
    event: "connector_requested",
    actor: "user",
    actor_id: user.id,
    payload: { provider: tool.provider, name: tool.name },
  });

  redirect(`/connecteurs?saved=${tool.provider}`);
}
