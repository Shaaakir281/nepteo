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
import { ConnectorSetupSteps } from "./_components/connector-setup-steps";
import { ConnectorDetailHeader } from "./_components/connector-detail-header";
import { MetaPilotAccessSection } from "./_components/meta-pilot-access-section";
import {
  readMetaPilotAccessRequest,
  type MetaPilotAccessRequest,
} from "@/lib/connectors/meta-pilot-access";

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

  let metaPilotRequest: MetaPilotAccessRequest | null = null;
  if (provider === "meta_ads" && !authorized) {
    const { data, error: requestError } = await supabase
      .from("meta_ads_pilot_access_requests")
      .select(
        "id, facebook_email, facebook_profile_url, status, requested_at, ready_at, connected_at",
      )
      .eq("organization_id", membership.organizationId)
      .eq("requested_by", user.id)
      .maybeSingle();
    if (requestError) throw new Error(requestError.message);
    metaPilotRequest = readMetaPilotAccessRequest(data);
  }

  return (
    <>
      <ConnectorDetailHeader tool={tool} presentation={presentation} config={config} saved={saved} synced={synced} error={error} />

      <ConnectorSetupSteps authorized={authorized} configured={configured} />

      {!authorized ? provider === "meta_ads" ? (
        <MetaPilotAccessSection request={metaPilotRequest} canEdit={canEdit} />
      ) : (
        <div className="rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
          <h2 className="font-display text-[16px] font-semibold text-ink">
            Autoriser la lecture de {tool.name}
          </h2>
          <p className="mt-2 text-[13px] text-body">
            Autorisez Nepteo à lire vos données — lecture seule, jetons chiffrés,
            accès révocable ici à tout moment.
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
              {!configured && membership.canViewFinancials && (
                <SourceConfiguration
                  provider={provider}
                  config={config}
                  canEdit={canEdit}
                  databases={remoteMetadata.databases}
                />
              )}

              {configured && (
                <>
                  <SyncSection
                    provider={provider}
                    configured={configured}
                    paused={paused}
                    canEdit={canEdit}
                    prospectCount={prospectCount}
                    preview={preview}
                  />
                  {membership.canViewFinancials && (
                    <details className="rounded-[13px] border border-line-soft bg-white px-4 py-3">
                      <summary className="cursor-pointer text-[12.5px] font-semibold text-body">
                        Paramètres de source et correspondance des colonnes
                      </summary>
                      <div className="mt-3 space-y-3">
                        <SourceConfiguration
                          provider={provider}
                          config={config}
                          canEdit={canEdit}
                          databases={remoteMetadata.databases}
                        />
                        {canEdit && (
                          <MappingSection
                            provider={provider}
                            state={remoteMetadata.columns}
                            mapping={remoteMetadata.mapping}
                            canEdit={canEdit}
                          />
                        )}
                      </div>
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
