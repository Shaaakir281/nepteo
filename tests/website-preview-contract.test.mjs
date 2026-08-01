import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, service, action, cron, sideCards] = await Promise.all([
  readFile(new URL("../supabase/migrations/0022_website_preview.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/research/website-preview.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/entreprise/laboratoire-web/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/cron/sync/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/entreprise/_components/side-cards.tsx", import.meta.url), "utf8"),
]);

test("website_preview — kind et cache dédiés, schéma 22", () => {
  assert.match(
    migration,
    /check \(kind in \('company_profile', 'prospect_company', 'website_preview'\)\)/i,
  );
  assert.match(
    migration,
    /create index research_runs_website_preview_expiry[\s\S]*where kind = 'website_preview'/i,
  );
  assert.match(migration, /greatest\(version, 22\)/i);
  assert.match(migration, /version >= 22/i);
});

test("website_preview — quota lisible sans réservation et service-role seulement", () => {
  assert.match(
    migration,
    /create or replace function public\.read_research_usage\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  assert.match(
    migration,
    /select usage\.reserved_calls[\s\S]*where usage\.organization_id = p_organization_id/i,
  );
  assert.doesNotMatch(migration, /reserved_calls\s*=\s*reserved_calls\s*\+/i);
  assert.match(
    migration,
    /revoke execute on function public\.read_research_usage\(uuid\)[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.read_research_usage\(uuid\)[\s\S]*to service_role/i,
  );
});

test("website_preview — RLS existante préservée et commercial exclu", () => {
  assert.match(migration, /table_def\.relrowsecurity/i);
  assert.match(migration, /policyname = 'research_runs_select'/i);
  assert.match(migration, /coalesce\(qual, ''\) like '%has_org_role%'/i);
  assert.match(migration, /coalesce\(qual, ''\) not like '%commercial%'/i);
  assert.doesNotMatch(migration, /create policy research_runs/i);
});

test("laboratoire — un seul appel externe via runResearch, aucune mémoire", () => {
  assert.match(service, /await runResearch\(admin,[\s\S]*kind: "website_preview"/);
  assert.doesNotMatch(service, /askResearch|askOpenAiSearch|askPerplexity/);
  assert.doesNotMatch(service, /generateText|company_memory|proposeIdentityForOrg/);
  assert.match(service, /parseIdentityProposal\(research\.text/);
});

test("laboratoire — confirmation, rôle éditeur, rétention et aucun verrou démo", () => {
  assert.match(action, /getEditorContext\(\)/);
  assert.match(action, /!context\?\.canEdit/);
  assert.match(action, /input\.confirmed !== true/);
  assert.match(action, /input\.force && input\.forceConfirmed !== true/);
  assert.match(action, /purgeExpiredWebsitePreviews\(admin\)/);
  assert.match(action, /readResearchQuota\(admin, context\.orgId\)/);
  assert.doesNotMatch(action, /withRealDataMutationLock|isDemoModeOrMutationActive/);
});

test("laboratoire — purge quotidienne et accès depuis Documents & sources", () => {
  assert.match(cron, /purgeExpiredWebsitePreviews\(admin\)/);
  assert.match(cron, /website_preview_retention/);
  assert.match(sideCards, /href="\/entreprise\/laboratoire-web"/);
  assert.match(sideCards, /y compris pendant un scénario d&apos;exemple/);
});
