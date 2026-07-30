import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [cron, manualAction, demoAction, engine] = await Promise.all([
  read("app/api/cron/sync/route.ts"),
  read("app/(cockpit)/_actions/analysis.ts"),
  read("app/(cockpit)/agent/actions.ts"),
  read("lib/analysis.ts"),
]);

test("analyse — clic et cron partagent le verrou distribué par organisation", () => {
  assert.match(
    cron,
    /withDemoMutationLock\(\s*admin,\s*orgId,\s*"analysis",\s*async \(\) =>/,
  );
  assert.match(
    manualAction,
    /withDemoMutationLock\(admin, ctx\.orgId, "analysis", async \(\) =>/,
  );
});

test("analyse cron — journal et moteur ne démarrent qu'après acquisition", () => {
  const lock = cron.indexOf("const proposed = await withDemoMutationLock(");
  const journal = cron.indexOf('event: "analysis_run"', lock);
  const analysis = cron.indexOf("return runAnalysis(admin, orgId, null)", lock);
  const callbackEnd = cron.indexOf("\n        },\n      );", lock);

  assert.ok(lock >= 0, "verrou du cron absent");
  assert.ok(journal > lock, "journal écrit avant le verrou");
  assert.ok(analysis > journal, "moteur lancé avant le journal verrouillé");
  assert.ok(callbackEnd > analysis, "moteur hors de la section critique");
});

test("analyse — le moteur reste non réentrant et la démo garde son verrou externe", () => {
  assert.doesNotMatch(engine, /withDemoMutationLock/);
  assert.match(
    demoAction,
    /withDemoMutationLock\(\s*admin,\s*ctx\.orgId,\s*"demo",[\s\S]*runAnalysis\(/,
  );
});
