"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/auth/context";
import {
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
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";
import { parseNotionDatabaseChoice } from "./_lib/detail-rules";
import {
  hasConnectorConsent,
  isConnectorPaused,
  setConnectorPaused,
} from "@/lib/connectors/lifecycle";

/** Liste des connecteurs = onglet de « Mon entreprise » depuis C4. La fiche
 *  par outil (`/connecteurs/<provider>`) reste, elle, un écran à part entière. */
const CONNECTORS_TAB = "/entreprise?onglet=connecteurs";

function fail(provider: string, message: string): never {
  redirect(`/connecteurs/${provider}?error=${encodeURIComponent(message)}`);
}

class ConnectorActionError extends Error {}

async function requireEditor(provider: string) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) fail(provider, "Votre rôle ne permet pas cette action.");
  return ctx;
}

async function loadConnector(
  orgId: string,
  provider: string,
  admin = createAdminClient(),
) {
  const { data, error } = await admin
    .from("connectors")
    .select(CONNECTOR_SELECT)
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { admin, connector: data as ConnectorRow | null };
}

async function mutateConnector<T>(
  provider: string,
  orgId: string,
  task: (admin: ReturnType<typeof createAdminClient>) => Promise<T>,
): Promise<T> {
  const admin = createAdminClient();
  try {
    return await withRealDataMutationLock(admin, orgId, () => task(admin));
  } catch (error) {
    if (error instanceof DemoDataMutationBlockedError) {
      fail(provider, "Retirez d'abord le scénario Nepteo avant cette action.");
    }
    if (error instanceof DemoBusyError) {
      fail(provider, "Une autre opération est en cours. Réessayez dans un instant.");
    }
    if (error instanceof ConnectorActionError) fail(provider, error.message);
    fail(provider, "Enregistrement impossible. Réessayez dans un instant.");
  }
}

async function saveConfig(
  provider: string,
  patch: Record<string, unknown>,
  userId: string,
) {
  const ctx = await requireEditor(provider);
  await mutateConnector(provider, ctx.orgId, async (admin) => {
    const { connector } = await loadConnector(ctx.orgId, provider, admin);
    if (!connector || !hasConnectorConsent(connector.config)) {
      throw new ConnectorActionError("Connecteur non connecté.");
    }
    const config = { ...(connector.config as Record<string, unknown>), ...patch };
    const { error } = await admin
      .from("connectors")
      .update({ config })
      .eq("id", connector.id);
    if (error) throw new Error(error.message);
    const journal = await admin.from("journal").insert({
      organization_id: ctx.orgId,
      event: "connector_configured",
      actor: "user",
      actor_id: userId,
      payload: { provider, name: findTool(provider)?.name },
    });
    if (journal.error) throw new Error(journal.error.message);
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
  const database = parseNotionDatabaseChoice(formData.get("database_choice"));
  const database_id = database?.id ?? "";
  const database_title = database?.title ?? "";
  if (!database_id) fail("notion", "Choisissez une base de données.");
  await saveConfig("notion", { database_id, database_title }, ctx.userId);
}

export async function saveFieldMapping(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isOauthProvider(provider)) redirect(CONNECTORS_TAB);
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
  if (!isOauthProvider(provider)) redirect(CONNECTORS_TAB);
  const ctx = await requireEditor(provider);
  const { admin, connector } = await loadConnector(ctx.orgId, provider);
  if (!connector || !hasConnectorConsent(connector.config)) {
    fail(provider, "Connecteur non connecté.");
  }
  if (isConnectorPaused(connector.config)) {
    fail(provider, "Connecteur en pause. Reprenez-le avant de synchroniser.");
  }
  if (!isSyncable(connector)) {
    fail(provider, "Configurez d'abord la source à lire ci-dessus.");
  }

  let count = 0;
  try {
    count = await syncConnectorRow(admin, connector, "user", ctx.userId);
  } catch (e) {
    if (e instanceof DemoDataMutationBlockedError) {
      fail(provider, "Retirez d'abord le scénario Nepteo avant de synchroniser.");
    }
    if (e instanceof DemoBusyError) {
      fail(provider, "Une autre opération est en cours. Réessayez dans un instant.");
    }
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect interne
    fail(provider, "Lecture impossible — vérifiez l'accès et réessayez.");
  }

  redirect(`/connecteurs/${provider}?synced=${count}`);
}

export async function disconnectConnector(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isOauthProvider(provider)) redirect(CONNECTORS_TAB);
  const ctx = await requireEditor(provider);
  await mutateConnector(provider, ctx.orgId, async (admin) => {
    const { connector } = await loadConnector(ctx.orgId, provider, admin);
    if (!connector) return;
    const config = { ...(connector.config ?? {}) };
    delete config.connection;
    const updated = await admin
      .from("connectors")
      .update({
        status: "disconnected",
        encrypted_credentials: null,
        config,
      })
      .eq("id", connector.id);
    if (updated.error) throw new Error(updated.error.message);
    const journal = await admin.from("journal").insert({
      organization_id: ctx.orgId,
      event: "connector_disconnected",
      actor: "user",
      actor_id: ctx.userId,
      payload: { provider, name: findTool(provider)?.name },
    });
    if (journal.error) throw new Error(journal.error.message);
  });
  redirect(CONNECTORS_TAB);
}

export async function setConnectorPause(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const pause = String(formData.get("pause") ?? "") === "true";
  if (!isOauthProvider(provider)) redirect(CONNECTORS_TAB);
  const ctx = await requireEditor(provider);
  await mutateConnector(provider, ctx.orgId, async (admin) => {
    const { connector } = await loadConnector(ctx.orgId, provider, admin);
    if (!connector || !hasConnectorConsent(connector.config)) {
      throw new ConnectorActionError("Connecteur non autorisé.");
    }
    const updated = await admin
      .from("connectors")
      .update({
        config: setConnectorPaused(
          connector.config ?? {},
          pause,
          new Date().toISOString(),
        ),
      })
      .eq("id", connector.id);
    if (updated.error) throw new Error(updated.error.message);
    const journal = await admin.from("journal").insert({
      organization_id: ctx.orgId,
      event: pause ? "connector_paused" : "connector_resumed",
      actor: "user",
      actor_id: ctx.userId,
      payload: { provider, name: findTool(provider)?.name },
    });
    if (journal.error) throw new Error(journal.error.message);
  });
  redirect(`/connecteurs/${provider}?saved=1`);
}
