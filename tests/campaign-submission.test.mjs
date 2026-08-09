import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  actions,
  modal,
  briefForm,
  review,
  campaignAi,
  migration25,
  migration26,
  history,
  drawer,
  executionMigration,
  researchRules,
] = await Promise.all([
  readFile(new URL("../app/(cockpit)/campagnes/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/campagnes/_components/new-campaign-modal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/campagnes/_components/campaign-brief-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/campagnes/_components/campaign-proposal-review.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/campaign.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/0025_campaign_proposals.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/0026_campaign_studio.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/_components/decisions-history.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(cockpit)/_components/validation-drawer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/0018_atomic_action_decisions.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/research/research-rules.ts", import.meta.url), "utf8"),
]);

function exportedFunctionSource(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `fonction absente : ${name}`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("CAMP-0 reste vrai — aucun choix engageant n'est présélectionné", () => {
  const emptyBrief = briefForm.slice(
    briefForm.indexOf("export const EMPTY_CAMPAIGN_BRIEF"),
    briefForm.indexOf("export function campaignBriefInput"),
  );
  for (const field of [
    "objective", "campaignType", "audience", "offer", "hypothesis", "channel",
    "dailyBudget", "durationDays", "primaryMetric", "successThreshold", "context",
  ]) {
    assert.match(emptyBrief, new RegExp(`${field}: ""`));
  }
  assert.match(modal, /setRequestKey\(crypto\.randomUUID\(\)\)/);
});

test("CAMP-1 construction — fenêtre observée puis unique geste IA, sans recherche automatique", () => {
  const build = exportedFunctionSource(actions, "buildCampaignAction");
  const validation = build.indexOf("validateCampaignBrief(input)");
  const evidence = build.indexOf("loadCampaignEvidence(");
  const generation = build.indexOf("generateCampaignHooks(");
  assert.ok(validation >= 0 && validation < evidence && evidence < generation);
  assert.match(actions, /buildCampaignProjection\(evidence, basePlan\.totalBudget\)/);
  assert.doesNotMatch(build, /runResearch|researchCampaignCompetitionAction/);
  assert.match(modal, /async function build\(\)[\s\S]*buildCampaignAction\(input\)/);
  assert.doesNotMatch(modal, /useEffect/);
  assert.match(campaignAi, /generateCampaignHooks[\s\S]*maxRetries: 0/);
  assert.match(campaignAi, /AbortSignal\.timeout\(CAMPAIGN_AI_TIMEOUT_MS\)/);
  assert.match(campaignAi, /telemetry: telemetryForTask\("draft_post"\)/);
  assert.doesNotMatch(campaignAi, /MAX_RESEARCH_PER_DAY|crédit OpenAI|openai credit/i);
});

test("CAMP-1 studio — structure, allocations, hooks et formats restent arbitrables", () => {
  assert.match(review, /Structure et allocation/);
  assert.match(review, /Allocation totale/);
  assert.match(review, /Hooks éditables et sélectionnés/);
  assert.match(review, /selectedHookIndices/);
  assert.match(review, /Formats attendus/);
  assert.match(review, /Données insuffisantes/);
  assert.match(review, /Scénario d'exemple|Scénario d&apos;exemple/);
});

test("CAMP-1 soumission — snapshot navigateur refusé et toutes les dérivations refaites", () => {
  const submit = exportedFunctionSource(actions, "submitCampaignAction");
  assert.match(submit, /validateCampaignBrief\(input\)/);
  assert.match(submit, /validateCampaignStudioIntent\(studioInput\)/);
  assert.match(submit, /loadCampaignEvidence\(admin, ctx\.orgId, brief\.channel\)/);
  assert.match(submit, /deriveCampaignPlanWithProjection\(brief, evidence\)/);
  assert.match(submit, /deriveCampaignStudioProposal\(studioValidation\.value/);
  assert.match(submit, /\.rpc\("propose_campaign_studio_action"/);
  assert.doesNotMatch(submit, /planInput|snapshotInput|expectedFormatsInput/);
  assert.doesNotMatch(submit, /\.from\("actions"\)|\.from\("journal"\)/);
  assert.match(modal, /submitCampaignAction\(\s*proposal\.brief,\s*proposal\.studio,\s*requestKey/);
});

test("CAMP-1 transaction — action proposée et journal partagent toujours une RPC", () => {
  const functionStart = migration26.indexOf("create or replace function public.propose_campaign_studio_action");
  const actionInsert = migration26.indexOf("insert into public.actions", functionStart);
  const journalInsert = migration26.indexOf("insert into public.journal", actionInsert);
  const functionEndOffset = migration26
    .slice(functionStart)
    .search(/end;\r?\n\$\$;/);
  const functionEnd =
    functionEndOffset === -1 ? -1 : functionStart + functionEndOffset;
  assert.ok(functionStart >= 0 && functionStart < actionInsert);
  assert.ok(actionInsert < journalInsert && journalInsert < functionEnd);
  const body = migration26.slice(functionStart, functionEnd);
  assert.match(body, /'launch_campaign'/);
  assert.match(body, /'proposed'/);
  assert.match(body, /v_allocation_total is distinct from 10000/);
  assert.match(body, /remainder_rank/);
  assert.match(body, /campaign studio selected variants are inconsistent/);
  assert.match(body, /membership\.role in \('admin', 'marketing', 'direction'\)/);
  assert.doesNotMatch(body, /outbox_messages|launched|sent/);
});

test("CAMP-1 idempotence — le rejeu compare l'intention, pas le snapshot mouvant", () => {
  assert.match(migration25, /actions_campaign_proposal_request_uidx[\s\S]*organization_id, proposal_request_key/);
  assert.match(migration26, /on conflict \(organization_id, proposal_request_key\)[\s\S]*do nothing/);
  const duplicate = migration26.indexOf("if v_action_id is null then");
  const journal = migration26.indexOf("insert into public.journal", duplicate);
  const replay = migration26.slice(duplicate, journal);
  assert.match(replay, /v_existing\.payload -> 'intent' is distinct from v_intent/);
  assert.doesNotMatch(replay, /v_existing\.payload is distinct from p_payload/);
  assert.match(replay, /return jsonb_build_object\('created', false, 'action_id', v_existing\.id\)/);
  assert.match(migration26, /idempotency intent conflict/);
});

test("CAMP-1 recherche — geste séparé, confirmé, sourcé et jamais en démo", () => {
  const research = exportedFunctionSource(actions, "researchCampaignCompetitionAction");
  const build = exportedFunctionSource(actions, "buildCampaignAction");
  const submit = exportedFunctionSource(actions, "submitCampaignAction");
  assert.match(research, /input\.confirmed !== true/);
  assert.match(research, /input\.force[\s\S]*input\.forceConfirmed !== true/);
  assert.match(research, /withRealDataMutationLock\(admin, ctx\.orgId/);
  assert.match(research, /DemoDataMutationBlockedError[\s\S]*demo_forbidden/);
  assert.match(research, /readResearchQuota/);
  assert.match(research, /runResearch\(admin,[\s\S]*kind: "campaign_competition"/);
  assert.doesNotMatch(build, /runResearch/);
  assert.doesNotMatch(submit, /runResearch/);
  assert.match(review, /Je confirme vouloir lancer cette recherche maintenant/);
  assert.match(researchRules, /campaign_competition/);
  assert.match(migration26, /research_runs_kind_check[\s\S]*campaign_competition/);
});

test("CAMP-1 démo, rôles et non-exécution restent fermés en profondeur", () => {
  const submit = exportedFunctionSource(actions, "submitCampaignAction");
  assert.match(submit, /if \(!ctx \|\| !ctx\.canManageCampaigns\)/);
  assert.match(submit, /withDemoMutationLock\(admin, ctx\.orgId, "campaign"/);
  assert.match(submit, /demo \? \{ demo: true \} : \{\}/);
  assert.doesNotMatch(submit, /outbox_messages|fetch\(|provider.*mutation/i);
  assert.doesNotMatch(
    executionMigration.slice(
      executionMigration.indexOf("create or replace function public.claim_action_execution"),
      executionMigration.indexOf("create or replace function public.finish_action_execution"),
    ),
    /launch_campaign/,
  );
  assert.match(history, /a\.kind === "launch_campaign"[\s\S]*Validée — non lancée/);
  assert.match(drawer, /validée — non lancée|Validée — non lancée/);
  assert.doesNotMatch(drawer, /calibrée sur vos propres données/);
});

test("CAMP-1 migration — schéma 26 et RPC réservée au service role", () => {
  assert.match(migration26, /set version = greatest\(version, 26\)/);
  assert.match(migration26, /grant execute on function public\.propose_campaign_studio_action[\s\S]*to service_role/);
  assert.match(migration26, /not_available_camp_1/);
});
