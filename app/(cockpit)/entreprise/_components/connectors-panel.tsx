import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { icons } from "@/components/icons";
import { CONNECTOR_CATALOG } from "@/lib/connectors";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import { DEMO_PROVIDER } from "@/lib/demo/seed";
import { DemoPanel } from "../../agent/_components/demo-panel";
import {
  ConnectorCard,
  type ConnectorStatus,
} from "../../connecteurs/_components/connector-card";

/**
 * Onglet « Connecteurs » — repris de l'ancienne page `/connecteurs`, qui
 * redirige désormais ici. Les fiches de configuration par outil restent sur
 * `/connecteurs/<provider>` : ce sont des sous-écrans, pas une entrée de menu.
 * Depuis C5, l'état vide (aucun connecteur branché) porte le mode
 * démonstration — déplacé depuis l'ancien onglet Agent.
 */
export async function ConnectorsPanel({
  canEdit,
  canViewConnectorConfig,
  canManageDemo,
  orgId,
  saved,
}: {
  canEdit: boolean;
  canViewConnectorConfig: boolean;
  canManageDemo: boolean;
  orgId: string;
  saved?: string;
}) {
  const rows = canViewConnectorConfig
    ? (
        await createAdminClient()
          .from("connectors")
          .select("provider, status, config")
          .eq("organization_id", orgId)
      ).data
    : (
        await (await createClient())
          .from("connectors")
          .select("provider, status")
          .eq("organization_id", orgId)
      ).data;

  const statusOf = (provider: string): ConnectorStatus => {
    const row = rows?.find((r) => r.provider === provider);
    if (!row) return "available";
    if (row.status === "connected") return "connected";
    if (
      "config" in row &&
      (row.config as { requested?: boolean } | null)?.requested
    )
      return "requested";
    return "available";
  };

  // Le connecteur `demo` porte les données de démonstration (voir
  // `prepareDemoConnector`, lib/demo/seed.ts) — toujours "connected" dès qu'un
  // scénario est chargé. Il ne compte pas comme un VRAI outil branché, sinon
  // le panneau démo disparaîtrait juste après avoir servi.
  const hasConnected = (rows ?? []).some(
    (r) => r.status === "connected" && r.provider !== DEMO_PROVIDER,
  );
  const hasDemo = (rows ?? []).some((r) => r.provider === DEMO_PROVIDER);

  return (
    <>
      <div className="mb-5 flex items-start gap-2.5 rounded-[13px] border border-line bg-tint-soft px-4 py-3 text-[12.5px] leading-relaxed text-body">
        <span className="mt-0.5 flex-none">{icons.info}</span>
        <span>
          Les connexions ouvrent <b>progressivement</b>. Cliquez «&nbsp;Connecter&nbsp;»
          sur les outils que vous utilisez : votre demande est enregistrée et
          vous serez prévenu dès que le branchement est prêt — les plus
          demandés arrivent en premier.
        </span>
      </div>

      {!hasConnected && (
        <div className="mb-7 rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">
              Pas d&apos;outil à brancher ?
            </h3>
            <p className="mt-0.5 text-[12px] text-muted">
              Essayez avec une entreprise fictive — identité, prospects,
              campagnes et ventes en un clic.
            </p>
          </div>
          <div className="p-[22px]">
            <DemoPanel
              canManageDemo={canManageDemo}
              scenarios={DEMO_SCENARIOS.map((s) => ({
                id: s.id,
                label: s.label,
                pitch: s.pitch,
              }))}
            />
          </div>
        </div>
      )}

      {hasDemo && (
        <p className="mb-4 rounded-[10px] bg-amber-tint px-4 py-2.5 text-[12.5px] text-body">
          Retirez la démonstration avant de connecter un outil réel.
        </p>
      )}

      {CONNECTOR_CATALOG.map((group) => (
        <section key={group.title} className="mb-7">
          <div className="mb-3">
            <h3 className="font-display text-[15px] font-semibold">
              {group.title}
            </h3>
            <p className="text-[12.5px] text-muted">{group.sub}</p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => (
              <ConnectorCard
                key={tool.provider}
                tool={tool}
                status={statusOf(tool.provider)}
                canEdit={canEdit && !hasDemo}
                blockedByDemo={hasDemo}
                justRequested={saved === tool.provider}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
        Vous pouvez utiliser Nepteo sans connexion : le cockpit s&apos;appuie
        d&apos;abord sur votre mémoire d&apos;entreprise. Chaque outil connecté
        enrichira ensuite les recommandations.
      </p>
    </>
  );
}
