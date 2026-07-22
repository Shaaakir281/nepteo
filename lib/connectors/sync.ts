import type { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { findTool } from "@/lib/connectors";
import {
  fetchSheetProspects,
  googleFreshToken,
  type GoogleCreds,
} from "./google-sheets";
import { fetchNotionProspects, type NotionCreds } from "./notion";
import type { FieldMapping } from "./common";

type Admin = ReturnType<typeof createAdminClient>;

export interface ConnectorRow {
  id: string;
  organization_id: string;
  provider: string;
  status: string;
  config: Record<string, unknown> | null;
  encrypted_credentials: string | null;
}

export const CONNECTOR_SELECT =
  "id, organization_id, provider, status, config, encrypted_credentials";

export function isSyncable(c: ConnectorRow): boolean {
  if (c.status !== "connected" || !c.encrypted_credentials) return false;
  const cfg = c.config ?? {};
  if (c.provider === "google_sheets") return Boolean(cfg.spreadsheet_id);
  if (c.provider === "notion") return Boolean(cfg.database_id);
  return false;
}

/** Sync d'un connecteur : lecture → upsert prospects → journal. Retourne le nombre lu. */
export async function syncConnectorRow(
  admin: Admin,
  c: ConnectorRow,
  actor: "user" | "agent",
  actorId: string | null,
): Promise<number> {
  const config = c.config ?? {};
  const mapping = (config.field_mapping as FieldMapping | undefined) ?? undefined;
  let prospects;

  if (c.provider === "google_sheets") {
    const creds = decryptJson<GoogleCreds>(c.encrypted_credentials!);
    const { token, updated } = await googleFreshToken(creds);
    if (updated) {
      await admin
        .from("connectors")
        .update({ encrypted_credentials: encryptJson(updated) })
        .eq("id", c.id);
    }
    prospects = await fetchSheetProspects(
      token,
      config.spreadsheet_id as string,
      mapping,
    );
  } else if (c.provider === "notion") {
    const creds = decryptJson<NotionCreds>(c.encrypted_credentials!);
    prospects = await fetchNotionProspects(
      creds.access_token,
      config.database_id as string,
      mapping,
    );
  } else {
    throw new Error(`Sync non supporté : ${c.provider}`);
  }

  const now = new Date().toISOString();
  if (prospects.length > 0) {
    const rows = prospects.map((p) => ({
      organization_id: c.organization_id,
      connector_id: c.id,
      source: c.provider,
      synced_at: now,
      ...p,
    }));
    const { error } = await admin
      .from("prospects")
      .upsert(rows, { onConflict: "connector_id,external_id" });
    if (error) throw new Error(error.message);
  }

  await admin
    .from("connectors")
    .update({
      config: { ...config, last_synced_at: now, last_sync_count: prospects.length },
    })
    .eq("id", c.id);

  await admin.from("journal").insert({
    organization_id: c.organization_id,
    event: "connector_synced",
    actor,
    actor_id: actorId,
    payload: {
      provider: c.provider,
      name: findTool(c.provider)?.name,
      count: prospects.length,
      mode: actor === "agent" ? "auto" : "manuel",
    },
  });

  return prospects.length;
}
