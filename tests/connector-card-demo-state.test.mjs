import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
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

test("interface — le libellé reste honnête et le marqueur bloque toujours OAuth", async () => {
  const [layout, sidebar, panel, card] = await Promise.all([
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
        "../app/(cockpit)/connecteurs/_components/connector-card.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(panel, /canEdit=\{canEdit && !hasDemo\}/);
  assert.match(panel, /blockedByDemo=\{hasDemo\}/);
  assert.match(panel, /demoPresentation=\{demoPresentation\}/);
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
