import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prospectPriority } from "../lib/analysis-rules.ts";
import { dedupeByEmail } from "../lib/dedupe-prospects.ts";
import { buildDemoProspects } from "../lib/demo/demo-rules.ts";
import { findScenario } from "../lib/demo/scenarios.ts";
import { canonicalizeProspectCohort } from "../lib/prospect-cohort-loader.ts";

const source = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("Aujourd'hui délègue le chargement au loader et ne chiffre que la cohorte complète", () => {
  const page = source("../app/(cockpit)/page.tsx");
  const dashboard = source("../app/(cockpit)/_lib/today-dashboard-data.ts");

  assert.match(
    dashboard,
    /loadProspectCohort\(\s*createSupabaseProspectReader\(supabase\)/,
  );
  assert.match(
    dashboard,
    /prospectCohort\.status === "complete"\s*\? prospectCohort\.rawRows\s*: \[\]/,
  );
  assert.match(
    dashboard,
    /prospectCohort\.status === "unavailable"\s*\? null\s*: prospectCohort\.importedCount/,
  );
  assert.match(
    page,
    /prospectCohort=\{\s*prospectCohort\.status === "complete"\s*\?\s*prospectCohort\.canonicalRows\s*:\s*null\s*\}/,
  );
  assert.match(page, /today=\{today\}/);
  assert.doesNotMatch(page, /PROSPECT_KPI_PAGE_SIZE/);
});

test("Contenu suspend seulement les suggestions chiffrées lorsque la cohorte n'est pas complète", () => {
  const page = source("../app/(cockpit)/contenu/page.tsx");

  assert.match(
    page,
    /prospectCohort\.status === "complete"\s*\?\s*computeFunnelStats\(prospectCohort\.canonicalRows, today\)/,
  );
  assert.match(page, /priorityCount: stats\?\.priority/);
  assert.match(page, /prospectCohort\.status !== "complete"/);
  assert.match(page, /Aucun total partiel n&apos;est utilisé/);
  assert.doesNotMatch(page, /\.from\(["']prospects["']\)/);
});

test("Prospects n'affiche un board que pour une cohorte complète et annonce les totaux exacts", () => {
  const page = source("../app/(cockpit)/prospects/page.tsx");

  assert.match(
    page,
    /prospectCohort\.status === "complete"\s*\?\s*\(prospectCohort\.dedupedRows as BoardProspect\[\]\)/,
  );
  assert.match(page, /prospectCohort\.status !== "complete"/);
  assert.match(page, /Vue prospects temporairement suspendue/);
  assert.match(page, /Aucun board, total ou taux partiel/);
  assert.match(page, /fiche[\s\S]*dédoublonnée/);
  assert.match(page, /doublon[\s\S]*masqué/);
  assert.match(page, /Deux comptages, deux usages/);
  assert.match(page, /prospectCohort\.canonicalCount/);
  assert.match(page, /cohorte métier prudente/);
  assert.match(page, /il ne suppose pas que deux[\s\S]*homonymes/);
  assert.match(
    page,
    /visualMissingEmailCount\.toLocaleString\("fr-FR"\)\}\{" "\}[\s\S]*sans email/,
  );
  assert.doesNotMatch(page, /\.limit\(500\)/);
});

test("Prospects explique l'écart prudent des statuts contradictoires du scénario Menuiserie", () => {
  const scenario = findScenario("artisan");
  assert.ok(scenario);

  const rows = buildDemoProspects(scenario.pool, scenario.id).map(
    (prospect) => ({
      ...prospect,
      id: prospect.external_id,
      source: "demo",
      synced_at: "2026-07-31T00:00:00.000Z",
    }),
  );
  const today = new Date().toISOString().slice(0, 10);
  const visualPriorityCount = dedupeByEmail(rows).filter(
    (prospect) => prospectPriority(prospect, today).tier === "priority",
  ).length;
  const canonical = canonicalizeProspectCohort(rows);
  const actionablePriorityCount = canonical.filter(
    (prospect) => prospectPriority(prospect, today).tier === "priority",
  ).length;
  const conflicts = canonical.filter(
    (prospect) => prospect.cohort_conflict === "active_stage_conflict",
  );

  assert.equal(visualPriorityCount, 13);
  assert.equal(actionablePriorityCount, 12);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].name, "Hugo Girard");

  const page = source("../app/(cockpit)/prospects/page.tsx");
  assert.match(
    page,
    /prospect\.cohort_conflict === "active_stage_conflict"/,
  );
  assert.match(
    page,
    /priorityCountsDiffer\s*=\s*visualPriorityCount !== actionablePriorityCount/,
  );
  assert.match(
    page,
    /Priorités :[\s\S]*visualPriorityCount[\s\S]*actionablePriorityCount[\s\S]*actionnable/,
  );
  assert.match(
    page,
    /statut\s+terminal[\s\S]*opposition[\s\S]*contact\s+récent[\s\S]*statuts\s+actifs[\s\S]*contradictoires/,
  );
});

test("Prospects explique aussi une priorité visuelle neutralisée par un DNC", () => {
  const rows = [
    {
      id: "active",
      name: "Alice Martin",
      email: "alice@example.test",
      company: "Nepteo",
      stage: "Nouveau",
      source: "demo",
      last_contact_at: null,
      synced_at: "2026-07-31T14:00:00.000Z",
    },
    {
      id: "dnc",
      name: "Alice Martin",
      email: "alice@example.test",
      company: "Nepteo",
      stage: "DNC",
      source: "demo",
      last_contact_at: null,
      synced_at: "2026-07-31T13:00:00.000Z",
    },
  ];
  const today = "2026-07-31";
  const visualPriorityCount = dedupeByEmail(rows).filter(
    (prospect) => prospectPriority(prospect, today).tier === "priority",
  ).length;
  const canonical = canonicalizeProspectCohort(rows);
  const actionablePriorityCount = canonical.filter(
    (prospect) => prospectPriority(prospect, today).tier === "priority",
  ).length;

  assert.equal(visualPriorityCount, 1);
  assert.equal(actionablePriorityCount, 0);
  assert.equal(canonical[0].stage, "DNC");
  assert.equal(canonical[0].cohort_conflict, undefined);

  const page = source("../app/(cockpit)/prospects/page.tsx");
  assert.match(
    page,
    /priorityCountsDiffer \|\| activeStageConflictCount > 0/,
  );
  assert.match(page, /explainMissingEmailCohort \|\| explainPriorityCohort/);
  assert.match(page, /\{explainPriorityCohort && \(/);
});
