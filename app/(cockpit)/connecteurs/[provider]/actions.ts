"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { getEditorContext, isOauthProvider } from "@/lib/connectors/common";
import {
  fetchSheetProspects,
  googleFreshToken,
  parseSpreadsheetId,
  type GoogleCreds,
} from "@/lib/connectors/google-sheets";
import {
  fetchNotionProspects,
  type NotionCreds,
} from "@/lib/connectors/notion";
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
    .select("id, status, config, encrypted_credentials")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  return { admin, connector: data };
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

export async function syncNow(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isOauthProvider(provider)) redirect("/connecteurs");
  const ctx = await requireEditor(provider);
  const { admin, connector } = await loadConnector(ctx.orgId, provider);
  if (!connector?.encrypted_credentials || connector.status !== "connected") {
    fail(provider, "Connecteur non connecté.");
  }
  const config = connector.config as Record<string, unknown>;

  let prospects;
  try {
    if (provider === "google_sheets") {
      const spreadsheetId = config.spreadsheet_id as string | undefined;
      if (!spreadsheetId) fail(provider, "Indiquez d'abord le classeur à lire.");
      const creds = decryptJson<GoogleCreds>(connector.encrypted_credentials);
      const { token, updated } = await googleFreshToken(creds);
      if (updated) {
        await admin
          .from("connectors")
          .update({ encrypted_credentials: encryptJson(updated) })
          .eq("id", connector.id);
      }
      prospects = await fetchSheetProspects(token, spreadsheetId);
    } else {
      const databaseId = config.database_id as string | undefined;
      if (!databaseId) fail(provider, "Choisissez d'abord la base à lire.");
      const creds = decryptJson<NotionCreds>(connector.encrypted_credentials);
      prospects = await fetchNotionProspects(creds.access_token, databaseId);
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect interne
    fail(provider, "Lecture impossible — vérifiez l'accès et réessayez.");
  }

  if (prospects.length > 0) {
    const rows = prospects.map((p) => ({
      organization_id: ctx.orgId,
      connector_id: connector.id,
      source: provider,
      synced_at: new Date().toISOString(),
      ...p,
    }));
    const { error } = await admin
      .from("prospects")
      .upsert(rows, { onConflict: "connector_id,external_id" });
    if (error) fail(provider, "Écriture des prospects impossible.");
  }

  await admin
    .from("connectors")
    .update({
      config: {
        ...config,
        last_synced_at: new Date().toISOString(),
        last_sync_count: prospects.length,
      },
    })
    .eq("id", connector.id);

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "connector_synced",
    actor: "user",
    actor_id: ctx.userId,
    payload: {
      provider,
      name: findTool(provider)?.name,
      count: prospects.length,
    },
  });

  redirect(`/connecteurs/${provider}?synced=${prospects.length}`);
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
