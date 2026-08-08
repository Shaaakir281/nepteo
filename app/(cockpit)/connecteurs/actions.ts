"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { findTool } from "@/lib/connectors";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";

/** Les connecteurs sont un onglet de « Mon entreprise » depuis C4 — on y
 *  revient directement plutôt que de passer par la redirection de
 *  `/connecteurs`, pour ne rien perdre du paramètre au passage. */
const CONNECTORS_TAB = "/entreprise?onglet=connecteurs";

function fail(message: string): never {
  redirect(`${CONNECTORS_TAB}&error=${encodeURIComponent(message)}`);
}

/**
 * Une demande de catalogue n'est jamais une connexion : elle est journalisée,
 * reste `disconnected` et n'ouvre aucun accès OAuth, MCP ou de synchronisation.
 * Les parcours réellement disponibles sont traités séparément, connecteur par
 * connecteur.
 */
export async function requestConnector(formData: FormData) {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canEdit) {
    fail("Votre rôle ne permet pas de gérer les connecteurs.");
  }

  const provider = String(formData.get("provider") ?? "");
  const tool = findTool(provider);
  if (!tool) fail("Connecteur inconnu.");

  const admin = createAdminClient();
  try {
    await withRealDataMutationLock(
      admin,
      membership.organizationId,
      async () => {
        const { error } = await admin.from("connectors").upsert(
          {
            organization_id: membership.organizationId,
            type: tool.type,
            provider: tool.provider,
            status: "disconnected",
            config: { requested: true, requested_at: new Date().toISOString() },
          },
          { onConflict: "organization_id,provider" },
        );
        if (error) throw new Error(error.message);

        const journal = await admin.from("journal").insert({
          organization_id: membership.organizationId,
          event: "connector_requested",
          actor: "user",
          actor_id: user.id,
          payload: { provider: tool.provider, name: tool.name },
        });
        if (journal.error) throw new Error(journal.error.message);
      },
    );
  } catch (error) {
    if (error instanceof DemoDataMutationBlockedError) {
      fail("Retirez d'abord le scénario Nepteo avant de gérer un connecteur.");
    }
    if (error instanceof DemoBusyError) {
      fail("Une autre opération est en cours. Réessayez dans un instant.");
    }
    fail("Demande impossible. Réessayez dans un instant.");
  }

  redirect(`${CONNECTORS_TAB}&saved=${tool.provider}`);
}
