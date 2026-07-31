import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyDemoLoadGuard,
  classifyDemoPresentation,
  isCertifiedDemoConnectorConfig,
} from "../lib/demo/presentation-rules.ts";

const certifiedEvidence = () => ({
  evidenceComplete: true,
  backups: 1,
  trustedDemoConnectors: 1,
  certifiedDemoConnectors: 1,
  certifiedCounts: {
    prospects: 30,
    campaignRows: 120,
    revenueEvents: 15,
  },
  demoProspects: 30,
  nonDemoConnectors: 0,
  nonDemoProspects: 0,
  demoCampaignRows: 120,
  nonDemoCampaignRows: 0,
  demoRevenueRows: 15,
  nonDemoRevenueRows: 0,
});

test("présentation — seul le contrat de seed versionné certifie les données fictives", () => {
  assert.equal(
    isCertifiedDemoConnectorConfig({
      demo: true,
      complete: true,
      scenario: "agence",
      seed_version: 2,
      loaded_at: "2026-07-30T12:00:00.000Z",
      counts: {
        prospects: 30,
        campaign_rows: 120,
        revenue_events: 15,
      },
    }),
    true,
  );
  assert.equal(isCertifiedDemoConnectorConfig({ demo: true }), false);
  assert.equal(
    isCertifiedDemoConnectorConfig({
      demo: true,
      complete: true,
      scenario: "agence",
      seed_version: 1,
      loaded_at: "2026-07-30T12:00:00.000Z",
      counts: {
        prospects: 30,
        campaign_rows: 120,
        revenue_events: 15,
      },
    }),
    false,
  );
  assert.equal(
    isCertifiedDemoConnectorConfig({
      demo: true,
      complete: true,
      scenario: "agence",
      seed_version: 2,
      loaded_at: "date-invalide",
      counts: {
        prospects: 30,
        campaign_rows: 120,
        revenue_events: 15,
      },
    }),
    false,
  );
  assert.equal(
    isCertifiedDemoConnectorConfig({
      demo: true,
      complete: true,
      scenario: "scenario-inconnu",
      seed_version: 2,
      loaded_at: "2026-07-30T12:00:00.000Z",
      counts: {
        prospects: 30,
        campaign_rows: 120,
        revenue_events: 15,
      },
    }),
    false,
  );
});

test("présentation — un scénario pur est certifié, tout mélange devient un environnement de test", () => {
  assert.equal(
    classifyDemoPresentation(certifiedEvidence()),
    "certified-demo",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      nonDemoProspects: 1,
    }),
    "test-environment",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      nonDemoConnectors: 1,
    }),
    "test-environment",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      certifiedDemoConnectors: 0,
      certifiedCounts: null,
    }),
    "test-environment",
    "un ancien marqueur demo n'est pas une certification",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      evidenceComplete: false,
    }),
    "test-environment",
    "une lecture incomplète ne doit jamais affirmer que les données sont fictives",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      backups: 0,
    }),
    "test-environment",
    "un seed sans sauvegarde complète n'est pas certifié",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      demoCampaignRows: 119,
    }),
    "test-environment",
    "les comptages réels doivent correspondre au contrat finalisé",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      nonDemoRevenueRows: 1,
    }),
    "test-environment",
    "une vente réelle interdit le libellé fictif",
  );
  assert.equal(
    classifyDemoPresentation({
      ...certifiedEvidence(),
      trustedDemoConnectors: 0,
      certifiedDemoConnectors: 0,
      demoProspects: 0,
      nonDemoProspects: 12,
    }),
    "test-environment",
    "les données du testeur sont présentées comme un environnement de test",
  );
  assert.equal(
    classifyDemoPresentation({
      evidenceComplete: true,
      backups: 0,
      trustedDemoConnectors: 0,
      certifiedDemoConnectors: 0,
      certifiedCounts: null,
      demoProspects: 0,
      nonDemoConnectors: 0,
      nonDemoProspects: 0,
      demoCampaignRows: 0,
      nonDemoCampaignRows: 0,
      demoRevenueRows: 0,
      nonDemoRevenueRows: 0,
    }),
    "none",
  );
});

test("chargement — V2 peut changer, ancien marqueur et données apportées bloquent avant le clic", () => {
  assert.deepEqual(
    classifyDemoLoadGuard(
      {
        active: false,
        legacy: false,
        conflicts: [],
      },
      false,
    ),
    {
      canLoad: true,
      checkFailed: false,
      requiresDemoRemoval: false,
      conflicts: [],
    },
  );
  assert.deepEqual(
    classifyDemoLoadGuard(
      {
        active: true,
        legacy: false,
        conflicts: [],
      },
      true,
    ),
    {
      canLoad: true,
      checkFailed: false,
      requiresDemoRemoval: false,
      conflicts: [],
    },
    "un scénario V2 pur reste remplaçable",
  );
  assert.deepEqual(
    classifyDemoLoadGuard(
      {
        active: true,
        legacy: true,
        conflicts: [],
      },
      false,
    ),
    {
      canLoad: false,
      checkFailed: false,
      requiresDemoRemoval: true,
      conflicts: [],
    },
    "un ancien marqueur demande un retrait explicite",
  );
  assert.deepEqual(
    classifyDemoLoadGuard(
      {
        active: true,
        legacy: true,
        conflicts: ["connectors", "prospects"],
      },
      false,
    ),
    {
      canLoad: false,
      checkFailed: false,
      requiresDemoRemoval: true,
      conflicts: ["connectors", "prospects"],
    },
    "le retrait du marqueur ne transforme pas les données apportées en démo",
  );
  assert.deepEqual(
    classifyDemoLoadGuard(
      {
        active: true,
        legacy: false,
        conflicts: ["actions"],
      },
      true,
    ),
    {
      canLoad: false,
      checkFailed: false,
      requiresDemoRemoval: false,
      conflicts: ["actions"],
    },
    "même un marqueur V2 ne contourne jamais l'inventaire serveur",
  );
  assert.deepEqual(classifyDemoLoadGuard(null, false), {
    canLoad: false,
    checkFailed: true,
    requiresDemoRemoval: false,
    conflicts: [],
  });
});

test("interface — le libellé reste honnête et le marqueur bloque toujours OAuth", async () => {
  const [layout, sidebar, panel, demoPanel, card] = await Promise.all([
    readFile(
      new URL("../app/(cockpit)/layout.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/_components/sidebar.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/entreprise/_components/connectors-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/agent/_components/demo-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/connecteurs/_components/connector-card.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(panel, /canEdit=\{canEdit && !hasDemo\}/);
  assert.match(panel, /blockedByDemo=\{hasDemo\}/);
  assert.match(panel, /demoPresentation=\{demoPresentation\}/);
  assert.match(panel, /readDemoLoadState\(admin, orgId\)\.catch\(\(\) => null\)/);
  assert.match(panel, /classifyDemoLoadGuard\(/);
  assert.match(panel, /\(!hasConnected \|\| hasDemo\)/);
  assert.match(
    panel,
    /!demoLoadGuard\.checkFailed && demoLoadState\?\.active === true/,
  );
  assert.doesNotMatch(
    panel,
    /hasRemovableDemoMarker\s*=[\s\S]{0,100}presentationSnapshot\.hasDemoMarker/,
  );
  assert.match(panel, /hasDemoMarker=\{hasRemovableDemoMarker\}/);
  assert.match(panel, /categories: loadBlockCategories/);
  assert.match(
    demoPanel,
    /disabled=\{busy !== null \|\| !loadGuard\.canLoad\}/,
  );
  assert.match(demoPanel, /Ancien marqueur de scénario détecté/);
  assert.match(demoPanel, /Données ou outils apportés à préserver/);
  assert.match(
    demoPanel,
    /Retirer l&apos;ancien scénario ne suffira donc pas à débloquer/,
  );
  assert.match(demoPanel, /\{hasDemoMarker && \(/);
  assert.match(
    layout,
    /demoPresentation === "certified-demo"[\s\S]*Scénario Nepteo — données fictives\.[\s\S]*Aucun[\s\S]*compte externe n&apos;est connecté/,
  );
  assert.match(
    layout,
    /demoPresentation === "test-environment"[\s\S]*Environnement de test\.[\s\S]*importées par le testeur/,
  );
  assert.match(sidebar, /Scénario Nepteo — données fictives/);
  assert.match(sidebar, /Environnement de test/);
  assert.match(
    panel,
    /demoPresentation === "certified-demo"[\s\S]*Scénario Nepteo — données fictives\./,
  );
  assert.match(
    panel,
    /demoPresentation === "test-environment"[\s\S]*Environnement de test\.[\s\S]*peuvent inclure celles du testeur/,
  );
  assert.match(
    card,
    /status === "available"[\s\S]*isOauthProvider\(tool\.provider\)[\s\S]*!canEdit[\s\S]*blockedByDemo[\s\S]*Environnement de test — connexion réelle désactivée/,
  );
  assert.match(
    card,
    /status !== "connected" && isOauthProvider\(tool\.provider\) && canEdit/,
    "le bouton OAuth des éditeurs hors démonstration reste disponible",
  );
});
