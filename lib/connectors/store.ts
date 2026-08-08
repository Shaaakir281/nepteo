import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJson } from "@/lib/crypto";
import { findTool } from "@/lib/connectors";
import { withRealDataMutationLock } from "@/lib/demo/lock";
import { recordConsent } from "@/lib/connectors/lifecycle";

/**
 * Vérification sérialisée au départ et au retour d'un flux OAuth. La vraie
 * persistance refait toujours ce contrôle sous le même verrou.
 */
export async function assertConnectorFlowAllowed(orgId: string): Promise<void> {
  const admin = createAdminClient();
  await withRealDataMutationLock(admin, orgId, async () => undefined);
}

/**
 * Enregistre un consentement OAuth, pas encore une connexion vérifiée.
 * La carte ne passe à « Connecté vérifié » qu'après une lecture complète de la
 * source choisie. Les credentials restent chiffrés et hors de `config`.
 */
export async function storeConnection(
  orgId: string,
  userId: string,
  provider: string,
  creds: unknown,
  extraConfig: Record<string, unknown> = {},
  grantedScopes: readonly string[] = [],
): Promise<void> {
  const tool = findTool(provider);
  if (!tool) throw new Error(`Provider inconnu : ${provider}`);
  const admin = createAdminClient();
  await withRealDataMutationLock(admin, orgId, async () => {
    const { data: existing, error: readError } = await admin
      .from("connectors")
      .select("config")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const now = new Date().toISOString();
    const config = recordConsent({
      ...((existing?.config as Record<string, unknown>) ?? {}),
      ...extraConfig,
    }, grantedScopes, now);
    delete (config as { requested?: unknown }).requested;

    const { error } = await admin.from("connectors").upsert(
      {
        organization_id: orgId,
        type: tool.type,
        provider,
        status: "disconnected",
        encrypted_credentials: encryptJson(creds),
        config,
      },
      { onConflict: "organization_id,provider" },
    );
    if (error) throw new Error(error.message);

    const journal = await admin.from("journal").insert({
      organization_id: orgId,
      event: "connector_authorized",
      actor: "user",
      actor_id: userId,
      payload: { provider, name: tool.name, scopes: grantedScopes.length },
    });
    if (journal.error) throw new Error(journal.error.message);
  });
}
