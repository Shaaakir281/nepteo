"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEditorContext,
  isOauthProvider,
  PROSPECT_FIELDS,
  type FieldMapping,
} from "@/lib/connectors/common";
import { parseSpreadsheetId } from "@/lib/connectors/google-sheets";
import {
  CONNECTOR_SELECT,
  isSyncable,
  syncConnectorRow,
  type ConnectorRow,
} from "@/lib/connectors/sync";
import { findTool } from "@/lib/connectors";

function fail(provider: string, message: string): never {
  redirect(`/connecteurs/${provider}?error=${encodeURIComponent(message)}`);
}

async function requireEditor(provider: string) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) fail(provider, "Votre rôle ne permet pas cette action.");
  return ctx;
}

async function loadConnector(orgId: string, provider: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("connectors")
    .select(CONNECTOR_SELECT)
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  return { admin, connector: data as ConnectorRow | null };
}

async function saveConfig(
  provider: string,
  patch: Record<string, unknown>,
  userId: string,
) {
  const ctx = await requireEditor(provider);
  const { admin, connector } = await loadConnector(ctx.orgId, provider);
  if (!connector) fail(provider, "Connecteur non connecté.");
  const config = { ...(connector.config as Record<string, unknown>), ...patch };
  const { error } = await admin
    .from("connectors")
    .update({ config })
    .eq("id", connector.id);
  if (error) fail(provider, "Enregistrement impossible.");
  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "connector_configured",
    actor: "user",
    actor_id: userId,
    payload: { provider, name: findTool(provider)?.name },
  });
  redirect(`/connecteurs/${provider}?saved=1`);
}

export async function saveSheetConfig(formData: FormData) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  const id = parseSpreadsheetId(String(formData.get("url") ?? ""));
  if (!id) fail("google_sheets", "URL ou identifiant de classeur invalide.");
  await saveConfig("google_sheets", { spreadsheet_id: id }, ctx.userId);
}

export async function saveNotionDatabase(formData: FormData) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  const database_id = String(formData.get("database_id") ?? "");
  const database_title = String(formData.get("database_title") ?? "");
  if (!database_id) fail("notion", "Choisissez une base de données.");
  await saveConfig("notion", { database_id, database_title }, ctx.userId);
}

export async function saveFieldMapping(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isOauthProvider(provider)) redirect("/connecteurs");
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  const mapping: FieldMapping = {};
  for (const field of PROSPECT_FIELDS) {
    const v = String(formData.get(field) ?? "").trim();
    mapping[field] = v || null; // « — (aucune) » → null (champ absent)
  }
  await saveConfig(provider, { field_mapping: mapping }, ctx.userId);
}

export async function syncNow(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isOauthProvider(provider)) redirect("/connecteurs");
  const ctx = await requireEditor(provider);
  const { admin, connector } = await loadConnector(ctx.orgId, provider);
  if (!connector || connector.status !== "connected") {
    fail(provider, "Connecteur non connecté.");
  }
  if (!isSyncable(connector)) {
    fail(provider, "Configurez d'abord la source à lire ci-dessus.");
  }

  let count = 0;
  try {
    count = await syncConnectorRow(admin, connector, "user", ctx.userId);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect interne
    fail(provider, "Lecture impossible — vérifiez l'accès et réessayez.");
  }

  redirect(`/connecteurs/${provider}?synced=${count}`);
}

export async function disconnectConnector(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isOauthProvider(provider)) redirect("/connecteurs");
  const ctx = await requireEditor(provider);
  const { admin, connector } = await loadConnector(ctx.orgId, provider);
  if (connector) {
    await admin
      .from("connectors")
      .update({ status: "disconnected", encrypted_credentials: null })
      .eq("id", connector.id);
    await admin.from("journal").insert({
      organization_id: ctx.orgId,
      event: "connector_disconnected",
      actor: "user",
      actor_id: ctx.userId,
      payload: { provider, name: findTool(provider)?.name },
    });
  }
  redirect("/connecteurs");
}
