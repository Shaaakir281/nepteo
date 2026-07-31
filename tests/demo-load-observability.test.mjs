import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEMO_SEED_VERSION } from "../lib/demo/version.ts";
import { isCertifiedDemoConnectorConfig } from "../lib/demo/presentation-rules.ts";
import { settleDemoAnalysis } from "../lib/demo/analysis-outcome.ts";

test("seed V2 — le marqueur stocké permet de certifier un scénario Nepteo", () => {
  assert.equal(DEMO_SEED_VERSION, 2);
  assert.equal(
    isCertifiedDemoConnectorConfig({
      demo: true,
      complete: true,
      scenario: "agence",
      seed_version: DEMO_SEED_VERSION,
      loaded_at: "2026-07-30T10:00:00.000Z",
      counts: {
        prospects: 30,
        campaign_rows: 120,
        revenue_events: 15,
      },
    }),
    true,
  );
});

test("chargement — les deux analyses ne peuvent plus échouer silencieusement", async () => {
  const [seed, action, panel] = await Promise.all([
    readFile(new URL("../lib/demo/seed.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/(cockpit)/agent/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/agent/_components/demo-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(seed, /seed_version: DEMO_SEED_VERSION/);
  assert.match(seed, /scenario: scenarioId/);
  assert.match(seed, /loaded_at: new Date\(\)\.toISOString\(\)/);
  assert.match(seed, /complete: true/);
  const backup = seed.indexOf("await backupMemoryOnce(");
  const invalidate = seed.indexOf("await invalidateDemoCertification(");
  const reset = seed.indexOf("await resetCockpitState(", invalidate);
  assert.ok(
    backup >= 0 && backup < invalidate && invalidate < reset,
    "l'ancien scénario doit perdre sa certification avant toute mutation du cockpit",
  );
  assert.ok(
    seed.indexOf("await finalizeDemoConnector(") >
      seed.indexOf('event: "demo_scenario_loaded"'),
    "la certification doit suivre toutes les données et leur journal",
  );

  assert.doesNotMatch(action, /catch\s*\{\s*\/\* ignoré volontairement \*\//);
  assert.match(action, /analysis\.prospects = \{\s*ok: false/);
  assert.match(action, /analysis\.campaigns = \{\s*ok: false/);
  assert.match(action, /return \{ ok: true, prospects: result\.prospects, created, analysis \}/);
  assert.match(action, /event: "analysis_run"/);
  assert.match(action, /mode: "demo_seed"/);
  assert.match(panel, /Analyse à relancer/);
});

test("analyses de seed — les quatre combinaisons succès/échec restent explicites", async () => {
  const success = (created) => () => Promise.resolve(created);
  const failure = (message) => () => Promise.reject(new Error(message));

  for (const [prospectTask, campaignTask, expected] of [
    [success(4), success(1), [true, 4, true, 1]],
    [failure("prospects indisponibles"), success(1), [false, 0, true, 1]],
    [success(4), failure("campagnes indisponibles"), [true, 4, false, 0]],
    [
      failure("prospects indisponibles"),
      failure("campagnes indisponibles"),
      [false, 0, false, 0],
    ],
  ]) {
    const prospects = await settleDemoAnalysis(prospectTask);
    const campaigns = await settleDemoAnalysis(campaignTask);
    assert.deepEqual(
      [prospects.ok, prospects.created, campaigns.ok, campaigns.created],
      expected,
    );
    if (!prospects.ok) assert.match(prospects.detail, /prospects indisponibles/);
    if (!campaigns.ok) assert.match(campaigns.detail, /campagnes indisponibles/);
  }
});
