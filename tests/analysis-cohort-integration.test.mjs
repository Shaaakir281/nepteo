import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(
    /\r\n/g,
    "\n",
  );

const [analysis, briefing] = await Promise.all([
  read("lib/analysis.ts"),
  read("lib/briefing.ts"),
]);

test("l'analyse charge une cohorte bornée et isole les données de démonstration", () => {
  assert.match(
    analysis,
    /createSupabaseProspectReader\(admin, \{[\s\S]*organizationId: orgId/,
  );
  assert.match(
    analysis,
    /options\?\.prospectSource[\s\S]*\{ source: options\.prospectSource \}[\s\S]*\{ excludeSource: DEMO_PROVIDER \}/,
  );
  assert.match(
    analysis,
    /loadProspectCohort\(reader, \{\s*maxRows: DEFAULT_PROSPECT_MAX_ROWS,\s*\}\)/,
  );
});

test("une cohorte incomplète arrête le flux avant briefing et actions", () => {
  const load = analysis.indexOf(
    "const cohort = await loadProspectCohort(reader, {",
  );
  const guard = analysis.indexOf('if (cohort.status !== "complete")');
  const briefingCall = analysis.indexOf("await refreshBriefing(");
  const actionRead = analysis.indexOf('.from("actions")');

  assert.ok(load >= 0, "chargement de cohorte absent");
  assert.ok(guard > load, "garde de complétude absent ou mal placé");
  assert.match(
    analysis.slice(guard, briefingCall),
    /throw new Error\(/,
    "le résultat incomplet doit lever avant le briefing",
  );
  assert.ok(
    briefingCall > guard,
    "le briefing ne doit être atteint qu'après la garde",
  );
  assert.ok(
    actionRead > guard,
    "les actions ne doivent être lues ou créées qu'après la garde",
  );
});

test("analyse et briefing partagent exactement la cohorte canonique", () => {
  assert.match(
    analysis,
    /refreshBriefing\(\s*admin,\s*orgId,\s*actorId,\s*cohort\.canonicalRows,\s*\{\s*demo: options\?\.demo/,
  );
  assert.match(
    analysis,
    /buildFindings\(\s*cohort\.canonicalRows,\s*cohort\.rawRows,\s*today,\s*\)/,
  );
  assert.match(briefing, /prospects: BriefingProspect\[\]/);
  assert.match(briefing, /computeFunnelStats\(prospects, today\)/);
  assert.doesNotMatch(briefing, /\.from\("prospects"\)/);
  assert.doesNotMatch(briefing, /prospectSource/);
});

test("le marquage démo reste propagé au briefing et aux actions", () => {
  assert.match(
    briefing,
    /stats: options\?\.demo \? \{ \.\.\.stats, demo: true \} : stats/,
  );
  assert.match(
    analysis,
    /payload: options\?\.demo \? \{ \.\.\.f\.payload, demo: true \} : f\.payload/,
  );
});
