import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [action, facade, runner] = await Promise.all([
  read("app/(cockpit)/_actions/analysis.ts"),
  read("app/(cockpit)/actions.ts"),
  read("app/(cockpit)/_components/analysis-runner.tsx"),
]);

test("analyse manuelle — le contrat distingue interdiction, occupation et échec", () => {
  assert.match(action, /export type AnalyzeNowResult/);
  assert.match(action, /"forbidden" \| "busy" \| "analysis_failed"/);
  assert.match(action, /reason: "forbidden"/);
  assert.match(action, /reason: "analysis_failed"/);
  assert.match(action, /error instanceof DemoBusyError \? "busy" : "analysis_failed"/);
  assert.match(facade, /Promise<AnalyzeNowResult>/);
});

test("analyse manuelle — un échec Ads reste un succès prospects avec avertissement", () => {
  assert.match(action, /warning\?: "ads_failed"/);
  assert.match(action, /adsFailed = true/);
  assert.match(
    action,
    /adsFailed \? \{ warning: "ads_failed" as const \} : \{\}/,
  );
  assert.match(runner, /result\.warning === "ads_failed"/);
  assert.match(runner, /Analyse publicitaire indisponible/);
  assert.match(runner, /tone: "warning"/);
});

test("analyse manuelle — le résultat serveur n'est plus ignoré", () => {
  assert.match(runner, /const \[result\] = await Promise\.all/);
  assert.match(runner, /if \(result\.ok\)/);
  assert.match(runner, /result\.created > 0/);
  assert.match(runner, /result\.reason === "busy"/);
  assert.match(runner, /role="status"/);
  assert.match(runner, /aria-live="polite"/);
  assert.doesNotMatch(
    runner,
    /await Promise\.all\(\[analyzeNow\(\), minDelay\]\);\s*\}/,
  );
});
