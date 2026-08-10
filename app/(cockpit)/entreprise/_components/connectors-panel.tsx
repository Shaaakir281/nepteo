import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTOR_CATALOG } from "@/lib/connectors";
import { connectionPresentation } from "@/lib/connectors/lifecycle";
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
import type { WalkthroughScenario } from "@/lib/onboarding/walkthrough";
import type { ConnectorStatus } from "../../connecteurs/_components/connector-card";
import { ConnectorCatalog } from "../../connecteurs/_components/connector-catalog";

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
  guidedScenario,
}: {
  canEdit: boolean;
  canViewConnectorConfig: boolean;
  canManageDemo: boolean;
  orgId: string;
  saved?: string;
  guidedScenario?: WalkthroughScenario;
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
    const presentation = connectionPresentation(
      row.status,
      "config" in row ? row.config : undefined,
    );
    if (presentation !== "available") return presentation;
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
    guidedScenario && demoPresentation !== "certified-demo"
      ? "Scénario choisi pour la prise en main"
      : demoPresentation === "certified-demo"
      ? "Scénario d'exemple actif"
      : demoLoadGuard.canLoad
        ? "Besoin de données pour tester ?"
        : "Scénarios d'exemple Nepteo";
  const scenarioPanelSubtitle =
    guidedScenario
      ? demoPresentation === "certified-demo"
        ? "Le scénario est actif. Vous pouvez reprendre la prise en main après avoir vérifié le résultat."
        : "Le chargement reste volontaire : vérifiez le scénario, puis confirmez l'action ci-dessous."
      : demoPresentation === "certified-demo"
      ? "Changez de métier ou retirez le scénario actuel en conservant votre fiche d'origine."
      : demoLoadGuard.canLoad
        ? "Chargez un jeu cohérent — identité, prospects, campagnes et ventes en un clic."
        : "Ils sont réservés à une organisation de test dédiée et vide ; vos données actuelles sont préservées.";
  const catalogEntries = CONNECTOR_CATALOG.flatMap((group) =>
    group.tools.map((tool) => ({
      category: group.title,
      tool,
      status: statusOf(tool.provider),
      justRequested: saved === tool.provider,
    })),
  );

  return (
    <>
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
              guided={Boolean(guidedScenario)}
              scenarios={DEMO_SCENARIOS.filter(
                (scenario) =>
                  !guidedScenario || scenario.id === guidedScenario,
              ).map((scenario) => ({
                id: scenario.id,
                label: scenario.label,
                pitch: scenario.pitch,
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

      <ConnectorCatalog
        entries={catalogEntries}
        categories={CONNECTOR_CATALOG.map((group) => group.title)}
        canEdit={canEdit && !hasDemo}
        blockedByDemo={hasDemo}
        demoPresentation={demoPresentation}
      />

      <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
        Vous pouvez utiliser Nepteo sans connexion : le cockpit s&apos;appuie
        d&apos;abord sur votre mémoire d&apos;entreprise. Chaque outil connecté
        enrichira ensuite les recommandations.
      </p>
    </>
  );
}
