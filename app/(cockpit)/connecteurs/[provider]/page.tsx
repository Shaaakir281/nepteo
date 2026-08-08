import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { findTool } from "@/lib/connectors";
import { isOauthProvider } from "@/lib/connectors/common";
import {
  connectionPresentation,
  hasConnectorConsent,
  isConnectorPaused,
} from "@/lib/connectors/lifecycle";
import { SourceConfiguration } from "./_components/source-configuration";
import { MappingSection } from "./_components/mapping-section";
import {
  SyncSection,
  type ProspectPreview,
} from "./_components/sync-section";
import { loadRemoteMetadata } from "./_lib/load-remote-metadata";
import { MetaAdsSection } from "./_components/meta-ads-section";
import { readSelectedMetaAdAccount } from "@/lib/connectors/meta-ads";

const fmtDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

interface VisibleConnector {
  id: string;
  status: string;
  config?: Record<string, unknown> | null;
}

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ saved?: string; synced?: string; error?: string }>;
}) {
  const { provider } = await params;
  const { saved, synced, error } = await searchParams;
  if (!isOauthProvider(provider)) notFound();
  const tool = findTool(provider)!;

  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  const canEdit = membership.canEdit;

  // `connectors.config` contient des identifiants de sources et des noms de
  // colonnes libres. Il n'est plus accordé au JWT authentifié : seuls les
  // rôles autorisés le chargent côté serveur, après résolution du tenant.
  const connector = (membership.canViewFinancials
    ? (
        await createAdminClient()
          .from("connectors")
          .select("id, status, config")
          .eq("organization_id", membership.organizationId)
          .eq("provider", provider)
          .maybeSingle()
      ).data
    : (
        await supabase
          .from("connectors")
          .select("id, status")
          .eq("organization_id", membership.organizationId)
          .eq("provider", provider)
          .maybeSingle()
      ).data) as VisibleConnector | null;
  const config = (connector?.config ?? {}) as Record<string, unknown>;
  const presentation = connectionPresentation(
    connector?.status ?? "disconnected",
    config,
  );
  const connected = presentation === "connected";
  const authorized = connected || hasConnectorConsent(config);
  const paused = isConnectorPaused(config);
  const sourceProvider =
    provider === "google_sheets" || provider === "notion" ? provider : null;
  const configured =
    provider === "meta_ads"
      ? Boolean(readSelectedMetaAdAccount(config))
      : provider === "google_sheets"
        ? Boolean(config.spreadsheet_id)
        : Boolean(config.database_id);

  let prospectCount = 0;
  let preview: ProspectPreview[] = [];
  if (connector) {
    const { count } = await supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("connector_id", connector.id);
    prospectCount = count ?? 0;

    const { data: rows } = await supabase
      .from("prospects")
      .select("name, email, company")
      .eq("connector_id", connector.id)
      .order("synced_at", { ascending: false })
      .limit(5);
    preview = rows ?? [];
  }

  const remoteMetadata = connector && sourceProvider
    ? await loadRemoteMetadata({
        provider: sourceProvider,
        connectorId: connector.id,
        connected: authorized,
        configured,
        canEdit,
        config,
      })
    : { databases: null, columns: null, mapping: {} };

  return (
    <>
      <Link
        href="/entreprise?onglet=connecteurs"
        className="text-[13px] text-muted hover:text-ink"
      >
        ← Tous les connecteurs
      </Link>
      <div className="mt-3 mb-5 flex items-center gap-3.5">
        <span
          className="grid h-11 w-11 flex-none place-items-center rounded-[11px] text-[15px] font-bold"
          style={{
            background: tool.color,
            color: tool.darkText ? "#1a1a2e" : "#fff",
          }}
        >
          {tool.letter}
        </span>
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">
            {tool.name}
          </h1>
          <p className="text-[12.5px] text-muted">
            {connected ? (
              <>
                <span className="font-semibold text-green">Connecté</span>
                {typeof config.workspace_name === "string" &&
                  ` · ${config.workspace_name}`}
                {typeof config.last_synced_at === "string" &&
                  ` · synchronisé le ${fmtDate.format(
                    new Date(config.last_synced_at),
                  )}`}
              </>
            ) : presentation === "configured" ? (
              "Accès autorisé — source à vérifier"
            ) : presentation === "paused" ? (
              "Lecture en pause"
            ) : presentation === "error" ? (
              "Dernière lecture en erreur"
            ) : (
              "Non connecté"
            )}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded-[10px] bg-green-tint px-4 py-2.5 text-[13px] font-medium text-green">
          Configuration enregistrée ✓
        </p>
      )}
      {synced && (
        <p className="mb-4 rounded-[10px] bg-green-tint px-4 py-2.5 text-[13px] font-medium text-green">
          Synchronisation terminée — {synced} prospect
          {Number(synced) > 1 ? "s" : ""} lu
          {Number(synced) > 1 ? "s" : ""} ✓
        </p>
      )}

      {!authorized ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
          <p className="text-[13.5px] text-body">
            {provider === "meta_ads"
              ? "Autorisez uniquement la lecture Meta Ads (ads_read) : aucun budget, campagne, créa ou pause publicitaire ne peut être modifié par Nepteo."
              : "Autorisez Nepteo à lire vos données — lecture seule, jetons chiffrés, accès révocable ici à tout moment."}
          </p>
          {canEdit && (
            <a
              href={`/api/connectors/${provider}/authorize`}
              className="mt-4 inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
            >
              Connecter {tool.name}
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {provider === "meta_ads" ? (
            membership.canViewFinancials && (
              <MetaAdsSection config={config} canEdit={canEdit} paused={paused} />
            )
          ) : (
            <>
              {membership.canViewFinancials && (
                <SourceConfiguration
                  provider={provider}
                  config={config}
                  canEdit={canEdit}
                  databases={remoteMetadata.databases}
                />
              )}

              {configured && canEdit && (
                <MappingSection
                  provider={provider}
                  state={remoteMetadata.columns}
                  mapping={remoteMetadata.mapping}
                  canEdit={canEdit}
                />
              )}

              <SyncSection
                provider={provider}
                configured={configured}
                paused={paused}
                canEdit={canEdit}
                prospectCount={prospectCount}
                preview={preview}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
