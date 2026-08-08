"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/auth/context";
import {
  isOauthProvider,
  isProspectSyncProvider,
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
  recordReadFailure,
  recordReadSuccess,
  setConnectorPaused,
} from "@/lib/connectors/lifecycle";
import { decryptJson } from "@/lib/crypto";
import {
  listMetaAdAccounts,
  readMetaAdAccountCandidates,
  readMetaCampaignInsights,
  readSelectedMetaAdAccount,
  type MetaCreds,
} from "@/lib/connectors/meta-ads";

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
  if (!isProspectSyncProvider(provider)) redirect(CONNECTORS_TAB);
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
  if (!isProspectSyncProvider(provider)) redirect(CONNECTORS_TAB);
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

async function metaReadFailure(
  admin: ReturnType<typeof createAdminClient>,
  connector: ConnectorRow,
  userId: string,
) {
  const now = new Date().toISOString();
  const config = connector.config ?? {};
  await admin
    .from("connectors")
    .update({ config: recordReadFailure(config, now) })
    .eq("id", connector.id);
  await admin.from("journal").insert({
    organization_id: connector.organization_id,
    event: "meta_ads_read_failed",
    actor: "user",
    actor_id: userId,
    payload: { provider: "meta_ads", error: "Lecture Meta Ads impossible." },
  });
}

function requireMetaConnector(connector: ConnectorRow | null): ConnectorRow {
  if (!connector || connector.provider !== "meta_ads" || !hasConnectorConsent(connector.config)) {
    throw new ConnectorActionError("Connecteur Meta Ads non autorisé.");
  }
  if (!connector.encrypted_credentials) {
    throw new ConnectorActionError("Jeton Meta Ads absent : reconnectez le compte.");
  }
  if (isConnectorPaused(connector.config)) {
    throw new ConnectorActionError("Lecture Meta Ads en pause. Reprenez-la avant cette action.");
  }
  return connector;
}

/**
 * Lit la liste courte de comptes uniquement après un geste explicite.
 * Les objets fournisseur complets ne sont jamais conservés : id, nom, devise
 * et fuseau suffisent au choix de compte et à l'audit.
 */
export async function listMetaAccounts() {
  const ctx = await requireEditor("meta_ads");
  await mutateConnector("meta_ads", ctx.orgId, async (admin) => {
    const { connector } = await loadConnector(ctx.orgId, "meta_ads", admin);
    const meta = requireMetaConnector(connector);
    try {
      const credentials = decryptJson<MetaCreds>(meta.encrypted_credentials!);
      const accounts = await listMetaAdAccounts(credentials.access_token);
      const config = {
        ...(meta.config ?? {}),
        meta_ad_account_candidates: accounts,
        meta_accounts_listed_at: new Date().toISOString(),
      };
      const updated = await admin.from("connectors").update({ config }).eq("id", meta.id);
      if (updated.error) throw new Error(updated.error.message);
      const journal = await admin.from("journal").insert({
        organization_id: ctx.orgId,
        event: "meta_ads_accounts_listed",
        actor: "user",
        actor_id: ctx.userId,
        payload: { provider: "meta_ads", count: accounts.length },
      });
      if (journal.error) throw new Error(journal.error.message);
    } catch (error) {
      if (error instanceof ConnectorActionError) throw error;
      await metaReadFailure(admin, meta, ctx.userId);
      throw new ConnectorActionError("Lecture des comptes Meta Ads impossible. Vérifiez l'accès puis réessayez.");
    }
  });
  redirect("/connecteurs/meta_ads?saved=1");
}

/** Le compte envoyé par le navigateur doit appartenir à la liste serveur bornée. */
export async function saveMetaAdAccount(formData: FormData) {
  const accountId = String(formData.get("account_id") ?? "");
  const ctx = await requireEditor("meta_ads");
  await mutateConnector("meta_ads", ctx.orgId, async (admin) => {
    const { connector } = await loadConnector(ctx.orgId, "meta_ads", admin);
    const meta = requireMetaConnector(connector);
    const account = readMetaAdAccountCandidates(meta.config).find((item) => item.id === accountId);
    if (!account) throw new ConnectorActionError("Choisissez un compte Meta Ads proposé par la liste relue.");
    const config = {
      ...(meta.config ?? {}),
      meta_ad_account: account,
    };
    delete (config as { meta_insights_snapshot?: unknown }).meta_insights_snapshot;
    const updated = await admin.from("connectors").update({ config }).eq("id", meta.id);
    if (updated.error) throw new Error(updated.error.message);
    const journal = await admin.from("journal").insert({
      organization_id: ctx.orgId,
      event: "meta_ads_account_selected",
      actor: "user",
      actor_id: ctx.userId,
      payload: { provider: "meta_ads", account_id: account.id, currency: account.currency },
    });
    if (journal.error) throw new Error(journal.error.message);
  });
  redirect("/connecteurs/meta_ads?saved=1");
}

/**
 * Première lecture de performances : GET Meta borné à 7/14/30 jours et 100
 * lignes. Une pagination ou une valeur ambiguë rend la lecture invalide au lieu
 * de tronquer ou de compléter silencieusement.
 */
export async function readMetaInsightsNow(formData: FormData) {
  const days = Number(formData.get("days"));
  const ctx = await requireEditor("meta_ads");
  await mutateConnector("meta_ads", ctx.orgId, async (admin) => {
    const { connector } = await loadConnector(ctx.orgId, "meta_ads", admin);
    const meta = requireMetaConnector(connector);
    const account = readSelectedMetaAdAccount(meta.config);
    if (!account) throw new ConnectorActionError("Choisissez d'abord un compte Meta Ads.");
    try {
      const credentials = decryptJson<MetaCreds>(meta.encrypted_credentials!);
      const snapshot = await readMetaCampaignInsights(credentials.access_token, account, days);
      const now = new Date().toISOString();
      const config = {
        ...(meta.config ?? {}),
        meta_insights_snapshot: snapshot,
        ...recordReadSuccess(meta.config ?? {}, now),
      };
      const updated = await admin
        .from("connectors")
        .update({ status: "connected", config })
        .eq("id", meta.id);
      if (updated.error) throw new Error(updated.error.message);
      const journal = await admin.from("journal").insert({
        organization_id: ctx.orgId,
        event: "meta_ads_metrics_read",
        actor: "user",
        actor_id: ctx.userId,
        payload: {
          provider: "meta_ads",
          account_id: account.id,
          currency: snapshot.currency,
          window_days: snapshot.window_days,
          count: snapshot.rows.length,
        },
      });
      if (journal.error) throw new Error(journal.error.message);
    } catch (error) {
      if (error instanceof ConnectorActionError) throw error;
      await metaReadFailure(admin, meta, ctx.userId);
      throw new ConnectorActionError("Lecture des métriques Meta Ads impossible. Aucune donnée partielle n'est affichée.");
    }
  });
  redirect("/connecteurs/meta_ads?saved=1");
}
