/**
 * Contrat de sécurité du mode démonstration.
 * Parties pures + quelques assertions structurelles sur les frontières I/O.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEMO_CAMPAIGN_PREFIX,
  DEMO_LOCK_SECTION,
  DEMO_PROVIDER,
  DEMO_REVENUE_PREFIX,
  buildDemoLoadState,
  demoProspectsMatchTrustedConnectors,
  demoCampaignId,
  demoIsolationConflicts,
  demoRevenueId,
  hasActiveDemoMarker,
  isConnectorRequestPlaceholder,
  isDemoAction,
  isDemoMutationLock,
  isEmptyBriefingStats,
  isNamespacedDemoCampaign,
  isNamespacedDemoRevenue,
  isTrustedDemoConnectorConfig,
  isTrustedDemoArtifact,
  legacyDemoCleanupAllowed,
  parseDemoLock,
} from "../lib/demo/isolation-rules.ts";

const emptyInventory = () => ({
  realConnectors: 0,
  realProspects: 0,
  realCampaignRows: 0,
  realRevenueRows: 0,
  realActions: 0,
  realOutbox: 0,
  realBriefings: 0,
});

test("identifiants démo — espace de noms explicite, jamais un ID réel historique", () => {
  assert.equal(DEMO_PROVIDER, "demo");
  assert.equal(DEMO_CAMPAIGN_PREFIX, "demo:");
  assert.equal(DEMO_REVENUE_PREFIX, "demo:");
  assert.equal(demoCampaignId("art_local"), "demo:art_local");
  assert.equal(demoRevenueId("artisan-sale-001"), "demo:artisan-sale-001");
  assert.equal(isNamespacedDemoCampaign("demo:art_local"), true);
  assert.equal(isNamespacedDemoCampaign("art_local"), false);
  assert.equal(isNamespacedDemoRevenue("demo:artisan-sale-001"), true);
  assert.equal(isNamespacedDemoRevenue("artisan-sale-001"), false);
});

test("actions démo — marqueur courant et ancien libellé explicite seulement", () => {
  assert.equal(isDemoAction({ payload: { demo: true } }), true);
  assert.equal(
    isDemoAction({ payload: {}, data_sources: ["prospects (demo)"] }),
    true,
  );
  assert.equal(
    isDemoAction({ payload: {}, data_sources: ["Meta Ads (démo)"] }),
    true,
  );
  assert.equal(
    isDemoAction({ payload: { demo: false }, data_sources: ["Meta Ads"] }),
    false,
  );
  assert.equal(isDemoAction({ payload: null, data_sources: null }), false);
});

test("mode démo — chaque marqueur explicite suffit, dont le connecteur orphelin", () => {
  assert.equal(
    hasActiveDemoMarker({
      backups: 0,
      seededProspects: 0,
      trustedDemoConnectors: 0,
    }),
    false,
  );
  assert.equal(
    hasActiveDemoMarker({
      backups: 1,
      seededProspects: 0,
      trustedDemoConnectors: 0,
    }),
    true,
  );
  assert.equal(
    hasActiveDemoMarker({
      backups: 0,
      seededProspects: 1,
      trustedDemoConnectors: 0,
    }),
    true,
  );
  assert.equal(
    hasActiveDemoMarker({
      backups: 0,
      seededProspects: 0,
      trustedDemoConnectors: 1,
    }),
    true,
    "un connector provider=demo isolé doit permettre son retrait",
  );
});

test("connecteur démo — le provider seul ne vaut jamais marqueur de confiance", () => {
  assert.equal(isTrustedDemoConnectorConfig(null), false);
  assert.equal(isTrustedDemoConnectorConfig("demo"), false);
  assert.equal(isTrustedDemoConnectorConfig({}), false);
  assert.equal(isTrustedDemoConnectorConfig({ demo: false }), false);
  assert.equal(isTrustedDemoConnectorConfig({ demo: true }), true);
  assert.equal(
    isTrustedDemoConnectorConfig({ demo: true, scenario: "legacy" }),
    true,
  );
});

test("organisation vide — une demande de connecteur ne bloque pas un scénario", () => {
  assert.equal(
    isConnectorRequestPlaceholder("disconnected", {
      requested: true,
      requested_at: "2026-08-11T08:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    isConnectorRequestPlaceholder("connected", { requested: true }),
    false,
  );
  assert.equal(
    isConnectorRequestPlaceholder("disconnected", {
      requested: true,
      connection: { version: 1 },
    }),
    false,
  );
  assert.equal(isConnectorRequestPlaceholder("disconnected", {}), false);
});

test("organisation vide — le briefing d'attente ne bloque pas un scénario", () => {
  assert.equal(
    isEmptyBriefingStats({
      total: 0,
      priority: 0,
      noEmail: 0,
      noStage: 0,
      topStage: null,
    }),
    true,
  );
  assert.equal(isEmptyBriefingStats({ total: 1 }), false);
  assert.equal(isEmptyBriefingStats({ total: 0, demo: true }), false);
  assert.equal(isEmptyBriefingStats(null), false);
});

test("prospects démo — chaque ligne doit dépendre d'un connecteur vérifié", () => {
  assert.equal(demoProspectsMatchTrustedConnectors([], []), true);
  assert.equal(
    demoProspectsMatchTrustedConnectors(["trusted"], ["trusted", "trusted"]),
    true,
  );
  assert.equal(
    demoProspectsMatchTrustedConnectors(["trusted"], ["other"]),
    false,
  );
  assert.equal(
    demoProspectsMatchTrustedConnectors(["trusted"], [null]),
    false,
  );
  assert.equal(
    demoProspectsMatchTrustedConnectors([], ["orphan"]),
    false,
  );
});

test("préflight — toute donnée réelle ferme le chargement, même entre A et B", () => {
  assert.deepEqual(demoIsolationConflicts(emptyInventory()), []);

  for (const [field, conflict] of [
    ["realConnectors", "connectors"],
    ["realProspects", "prospects"],
    ["realCampaignRows", "campaigns"],
    ["realRevenueRows", "revenue"],
    ["realActions", "actions"],
    ["realOutbox", "outbox"],
    ["realBriefings", "briefing"],
  ]) {
    const inventory = emptyInventory();
    inventory[field] = 1;
    assert.deepEqual(
      demoIsolationConflicts(inventory),
      [conflict],
      `${field} doit fermer le préflight`,
    );
  }
});

test("préflight UI — l'état de chargement conserve marqueur, legacy et catégories", () => {
  const inventory = emptyInventory();
  inventory.realConnectors = 1;
  inventory.realProspects = 12;
  assert.deepEqual(buildDemoLoadState(true, true, inventory), {
    active: true,
    legacy: true,
    conflicts: ["connectors", "prospects"],
  });
});

test("compatibilité legacy — un ancien ID n'est nettoyable qu'en démo active", () => {
  assert.equal(legacyDemoCleanupAllowed(false, 10, 10), false);
  assert.equal(legacyDemoCleanupAllowed(true, 0, 0), false);
  assert.equal(legacyDemoCleanupAllowed(true, 1, 0), true);
  assert.equal(legacyDemoCleanupAllowed(true, 0, 1), true);
  assert.equal(isTrustedDemoArtifact(false, true), false);
  assert.equal(isTrustedDemoArtifact(true, true), true);
  assert.equal(isTrustedDemoArtifact(true, false), false);
});

test("verrou — contenu validé et ligne illisible fail-closed", () => {
  assert.equal(DEMO_LOCK_SECTION, "__demo_lock");
  const acquired = "2026-07-29T10:00:00.000Z";
  const lock = {
    token: "token-123456",
    acquired_at: acquired,
    purpose: "demo",
  };
  assert.deepEqual(parseDemoLock(lock), lock);
  assert.equal(isDemoMutationLock(lock), true);
  assert.equal(isDemoMutationLock({ ...lock, purpose: "analysis" }), false);
  assert.equal(isDemoMutationLock({ ...lock, purpose: "campaign" }), false);
  assert.equal(isDemoMutationLock({ ...lock, purpose: "data" }), false);
  assert.equal(
    isDemoMutationLock({ token: "token-123456", acquired_at: acquired }),
    true,
    "un verrou ancien sans objet reste bloquant",
  );
  assert.equal(isDemoMutationLock({ purpose: "analysis" }), true);
});

test("frontières I/O — admin, lock propriétaire, scopes et clear no-op", async () => {
  const [
    actions,
    lock,
    isolation,
    seed,
    enterpriseActions,
    onboardingIdentity,
    connectorActions,
    connectorDetailActions,
    connectorStore,
    connectorSync,
    googleAuthorize,
    googleCallback,
    notionAuthorize,
    notionCallback,
    enterprisePage,
    campaignActions,
    actionDrafts,
  ] = await Promise.all([
    readFile(new URL("../app/(cockpit)/agent/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/demo/lock.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/demo/isolation.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/demo/seed.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/(cockpit)/entreprise/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/onboarding/identite/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/(cockpit)/connecteurs/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/connecteurs/[provider]/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/connectors/store.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors/sync.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/api/connectors/google_sheets/authorize/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/connectors/google_sheets/callback/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/connectors/notion/authorize/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/connectors/notion/callback/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/(cockpit)/entreprise/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/(cockpit)/campagnes/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/(cockpit)/_actions/action-drafts.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(actions, /ctx\.role !== "admin"/);
  assert.match(actions, /withDemoMutationLock\(/);
  assert.match(actions, /prospectSource:\s*DEMO_PROVIDER/);
  assert.match(actions, /campaignIdPrefix:\s*DEMO_CAMPAIGN_PREFIX/);

  assert.match(lock, /\.eq\("id", lockId\)/);
  assert.match(lock, /\.contains\("content", \{ token \}\)/);
  assert.match(
    lock,
    /if \(freshId\) return freshId;[\s\S]*throw new DemoBusyError\(\)/,
  );
  assert.equal(
    lock.match(/\.delete\(\)/g)?.length,
    1,
    "la seule suppression du verrou est sa libération par son propriétaire",
  );
  assert.doesNotMatch(lock, /isStaleDemoLock|recoveredId|Date\.now\(\)/);
  assert.match(lock, /purpose: DemoLockPurpose/);
  assert.match(lock, /withDemoMutationLock\(admin, orgId, "data"/);
  assert.match(lock, /if \(await isDemoModeActive\(admin, orgId\)\)/);

  assert.match(isolation, /source\.neq\.\$\{DEMO_PROVIDER\},source\.is\.null/);
  assert.match(isolation, /const \[backup, prospects, connector\] = await Promise\.all/);
  assert.match(
    isolation,
    /\.from\("connectors"\)[\s\S]*?\.eq\("provider", DEMO_PROVIDER\)[\s\S]*?\.contains\("config", \{ demo: true \}\)/,
  );
  assert.match(isolation, /hasActiveDemoMarker\(\{/);
  assert.match(
    seed,
    /async function demoConnectorIds[\s\S]*?\.eq\("provider", DEMO_PROVIDER\)[\s\S]*?\.contains\("config", \{ demo: true \}\)/,
  );
  assert.match(
    seed,
    /async function deleteDemoProspects[\s\S]*?\.eq\("source", DEMO_PROVIDER\)/,
  );
  assert.match(
    seed,
    /await assertDemoProspectsAreAligned\(admin, args\.orgId, ids\);\s+await deleteDemoProspects\(admin, ids\);\s+await assertDemoConnectorsEmpty\(admin, args\.orgId, ids\);/,
  );
  assert.match(
    isolation,
    /providerDemoConnectors[\s\S]*?isTrustedDemoConnectorConfig\(connector\.config\)/,
  );
  assert.match(isolation, /if \(active\) \{/);
  assert.match(isolation, /isTrustedDemoArtifact\(active,/);
  assert.match(isolation, /isDemoMutationLock\(lock\.data\.content\)/);
  assert.match(isolation, /realActions:/);
  assert.match(isolation, /realBriefings:/);

  assert.match(seed, /const markers = await readDemoModeMarkers/);
  assert.match(seed, /if \(!markers\.active\) return;/);
  assert.match(seed, /const remainingMarkers = await readDemoModeMarkers/);
  assert.match(seed, /if \(remainingMarkers\.active\)/);
  assert.match(seed, /if \(legacy\)/);
  assert.match(seed, /\.like\("campaign_id", `\$\{DEMO_CAMPAIGN_PREFIX\}%`\)/);
  assert.match(seed, /\.like\("external_id", `\$\{DEMO_REVENUE_PREFIX\}%`\)/);
  assert.doesNotMatch(
    seed,
    /\.eq\("provider", "meta_ads"\);\s*ensureOk/s,
    "aucune suppression globale de Meta Ads",
  );
  assert.match(seed, /\.filter\(\(row\) => isDemoAction\(row\)\)/);
  assert.match(seed, /stats\.demo === true/);
  assert.ok(
    seed.indexOf("await backupMemoryOnce") <
      seed.indexOf("await resetCockpitState"),
    "la sauvegarde validée précède toute remise à zéro",
  );
  assert.ok(
    seed.indexOf("await backupMemoryOnce") < seed.indexOf("await seedMemory"),
    "la sauvegarde validée précède le seed mémoire",
  );

  assert.match(enterpriseActions, /isDemoModeOrMutationActive\(/);
  assert.match(onboardingIdentity, /isDemoModeOrMutationActive\(/);
  assert.match(enterpriseActions, /withRealDataMutationLock\(/);
  assert.match(onboardingIdentity, /withRealDataMutationLock\(/);
  assert.match(connectorActions, /withRealDataMutationLock\(/);
  assert.match(connectorDetailActions, /withRealDataMutationLock\(/);
  assert.match(connectorStore, /withRealDataMutationLock\(/);
  assert.match(connectorSync, /withRealDataMutationLock\(/);
  assert.match(connectorSync, /syncConnectorRowUnlocked/);
  assert.match(connectorStore, /assertConnectorFlowAllowed/);
  for (const route of [
    googleAuthorize,
    googleCallback,
    notionAuthorize,
    notionCallback,
  ]) {
    assert.match(route, /assertConnectorFlowAllowed\(ctx\.orgId\)/);
  }
  assert.match(enterprisePage, /membership\.role === "admin"/);
  assert.match(enterprisePage, /canManageDemo=\{canManageDemo\}/);
  assert.ok(
    campaignActions.match(/withDemoMutationLock\(/g)?.length >= 2,
    "soumission et analyse de campagne sont sérialisées avec la démo",
  );
  assert.match(campaignActions, /ctx\.orgId, "campaign"/);
  assert.match(campaignActions, /ctx\.orgId, "analysis"/);
  assert.match(actionDrafts, /if \(enrich && !demo && prospect\.company\)/);
});
