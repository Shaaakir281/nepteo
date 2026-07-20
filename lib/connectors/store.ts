import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJson } from "@/lib/crypto";
import { findTool } from "@/lib/connectors";

/** Enregistre une connexion OAuth : credentials chiffrés + journal. */
export async function storeConnection(
  orgId: string,
  userId: string,
  provider: string,
  creds: unknown,
  extraConfig: Record<string, unknown> = {},
): Promise<void> {
  const tool = findTool(provider);
  if (!tool) throw new Error(`Provider inconnu : ${provider}`);
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("connectors")
    .select("config")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .maybeSingle();

  const config = {
    ...((existing?.config as Record<string, unknown>) ?? {}),
    ...extraConfig,
    connected_at: new Date().toISOString(),
  };
  delete (config as { requested?: unknown }).requested;

  const { error } = await admin.from("connectors").upsert(
    {
      organization_id: orgId,
      type: tool.type,
      provider,
      status: "connected",
      encrypted_credentials: encryptJson(creds),
      config,
    },
    { onConflict: "organization_id,provider" },
  );
  if (error) throw new Error(error.message);

  await admin.from("journal").insert({
    organization_id: orgId,
    event: "connector_connected",
    actor: "user",
    actor_id: userId,
    payload: { provider, name: tool.name },
  });
}
