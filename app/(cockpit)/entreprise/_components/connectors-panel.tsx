import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { icons } from "@/components/icons";
import { CONNECTOR_CATALOG } from "@/lib/connectors";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import {
  DEMO_PROVIDER,
  isTrustedDemoConnectorConfig,
} from "@/lib/demo/isolation-rules";
import {
  DEMO_ISOLATION_CONFLICT_LABELS,
  readDemoLoadState,
} from "@/lib/demo/isolation";
import { readDemoPresentation } from "@/lib/demo/presentation";
import { classifyDemoLoadGuard } from "@/lib/demo/presentation-rules";
import { DemoPanel } from "../../agent/_components/demo-panel";
import {
  ConnectorCard,
  type ConnectorStatus,
} from "../../connecteurs/_components/connector-card";

/**
 * Onglet « Connecteurs » — repris de l'ancienne page `/connecteurs`, qui
 * redirige désormais ici. Les fiches de configuration par outil restent sur
 * `/connecteurs/<provider>` : ce sont des sous-écrans, pas une entrée de menu.
 * Depuis C5, l'état vide (aucun connecteur branché) porte les scénarios
 * d'exemple — déplacés depuis l'ancien onglet Agent.
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
  const admin = createAdminClient();
  const rowsResult = canViewConnectorConfig
    ? (
        await admin
          .from("connectors")
          .select("provider, status, config")
          .eq("organization_id", orgId)
      )
    : (
        await (await createClient())
          .from("connectors")
          .select("provider, status")
          .eq("organization_id", orgId)
      );
  const rows = rowsResult.data;
  const [presentationSnapshot, demoLoadState] = await Promise.all([
    readDemoPresentation(orgId),
    readDemoLoadState(admin, orgId).catch(() => null),
  ]);
  const demoPresentation = presentationSnapshot.presentation;
  const verifiedDemoLoadState = presentationSnapshot.evidence.evidenceComplete
    ? demoLoadState
    : null;
  const hasCertifiedDemoMarker =
    presentationSnapshot.evidence.evidenceComplete &&
    presentationSnapshot.evidence.certifiedDemoConnectors === 1;
  const demoLoadGuard = classifyDemoLoadGuard(
    verifiedDemoLoadState,
    hasCertifiedDemoMarker,
  );
  const loadBlockCategories = demoLoadGuard.conflicts.map(
    (conflict) => DEMO_ISOLATION_CONFLICT_LABELS[conflict],
  );

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

  // Le connecteur `demo` porte les données du scénario d'exemple (voir
  // `prepareDemoConnector`, lib/demo/seed.ts) — toujours "connected" dès qu'un
  // scénario est chargé. Il ne compte pas comme un VRAI outil branché, sinon
  // le panneau démo disparaîtrait juste après avoir servi.
  const hasConnected = (rows ?? []).some(
    (r) => r.status === "connected" && r.provider !== DEMO_PROVIDER,
  );
  const hasVisibleDemoMarker = (rows ?? []).some(
    (r) =>
      r.provider === DEMO_PROVIDER &&
      (!("config" in r) || isTrustedDemoConnectorConfig(r.config)),
  );
  const hasDemo =
    hasVisibleDemoMarker ||
    presentationSnapshot.hasDemoMarker ||
    Boolean(rowsResult.error);
  const hasRemovableDemoMarker =
    !demoLoadGuard.checkFailed && demoLoadState?.active === true;
  const scenarioPanelTitle =
    demoPresentation === "certified-demo"
      ? "Scénario d'exemple actif"
      : demoLoadGuard.canLoad
        ? "Besoin de données pour tester ?"
        : "Scénarios d'exemple Nepteo";
  const scenarioPanelSubtitle =
    demoPresentation === "certified-demo"
      ? "Changez de métier ou retirez le scénario actuel en conservant votre fiche d'origine."
      : demoLoadGuard.canLoad
        ? "Chargez un jeu cohérent — identité, prospects, campagnes et ventes en un clic."
        : "Ils sont réservés à une organisation de test dédiée et vide ; vos données actuelles sont préservées.";

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

      {(!hasConnected || hasDemo) && (
        <div className="mb-7 rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">
              {scenarioPanelTitle}
            </h3>
            <p className="mt-0.5 text-[12px] text-muted">
              {scenarioPanelSubtitle}
            </p>
          </div>
          <div className="p-[22px]">
            <DemoPanel
              canManageDemo={canManageDemo}
              hasDemoMarker={hasRemovableDemoMarker}
              loadGuard={{
                canLoad: demoLoadGuard.canLoad,
                checkFailed: demoLoadGuard.checkFailed,
                requiresDemoRemoval: demoLoadGuard.requiresDemoRemoval,
                categories: loadBlockCategories,
              }}
              scenarios={DEMO_SCENARIOS.map((s) => ({
                id: s.id,
                label: s.label,
                pitch: s.pitch,
              }))}
            />
          </div>
        </div>
      )}

      {hasDemo && demoPresentation === "certified-demo" && (
        <p className="mb-4 rounded-[10px] bg-amber-tint px-4 py-2.5 text-[12.5px] text-body">
          <b>Scénario d&apos;exemple Nepteo.</b> Le jeu versionné ne contient
          aucun connecteur ou prospect apporté par le testeur. Les connexions
          externes restent désactivées pendant ce scénario.
        </p>
      )}

      {hasDemo && demoPresentation === "test-environment" && (
        <p className="mb-4 rounded-[10px] bg-amber-tint px-4 py-2.5 text-[12.5px] text-body">
          <b>Environnement de test.</b> Cet espace peut contenir des données
          apportées par le testeur et Nepteo ne peut pas certifier qu&apos;il
          contient uniquement un scénario d&apos;exemple. Par précaution, les
          connexions externes restent désactivées tant que cet état n&apos;est
          pas clarifié.
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
                demoPresentation={demoPresentation}
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
