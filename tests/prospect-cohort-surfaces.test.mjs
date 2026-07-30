import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("Aujourd'hui délègue le chargement au loader et ne chiffre que la cohorte complète", () => {
  const page = source("../app/(cockpit)/page.tsx");

  assert.match(
    page,
    /loadProspectCohort\(\s*createSupabaseProspectReader\(supabase\)/,
  );
  assert.match(
    page,
    /prospectCohort\.status === "complete"\s*\? prospectCohort\.rawRows\s*: \[\]/,
  );
  assert.match(
    page,
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
  assert.doesNotMatch(page, /\.limit\(500\)/);
});
