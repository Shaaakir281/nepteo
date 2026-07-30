import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const decisions = await readFile(
  new URL("../app/(cockpit)/_actions/decisions.ts", import.meta.url),
  "utf8",
);
const execution = await readFile(
  new URL("../lib/execution.ts", import.meta.url),
  "utf8",
);
const executionActions = await readFile(
  new URL("../app/(cockpit)/_actions/execution.ts", import.meta.url),
  "utf8",
);
const agentActions = await readFile(
  new URL("../app/(cockpit)/agent/actions.ts", import.meta.url),
  "utf8",
);
const executionControls = await readFile(
  new URL("../lib/execution-controls.ts", import.meta.url),
  "utf8",
);
const transitionMigration = await readFile(
  new URL(
    "../supabase/migrations/0018_atomic_action_decisions.sql",
    import.meta.url,
  ),
  "utf8",
);

function exportedFunctionSource(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `fonction exportée absente : ${name}`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("décisions — la RPC transactionnelle désigne l'unique gagnant", () => {
  const decide = exportedFunctionSource(decisions, "decideAction");
  assert.match(decide, /await transitionAction\(/);
  assert.match(decide, /decision as ActionTransition/);
  assert.match(decide, /if \(!changed\) redirect\("\/"\)/);
  assert.doesNotMatch(decide, /\.from\("actions"\)/);
  assert.doesNotMatch(decide, /\.from\("journal"\)/);
});

test("reprise — postponed et son journal sont consommés dans la même RPC", () => {
  const resume = exportedFunctionSource(decisions, "resumeAction");
  assert.match(resume, /transitionAction\(admin, ctx, id, "resume"\)/);
  assert.match(resume, /if \(!changed\) redirect\("\/"\)/);
  assert.doesNotMatch(resume, /\.from\("actions"\)/);
  assert.doesNotMatch(resume, /\.from\("journal"\)/);
});

test("migration décisions — CAS et journal partagent une transaction PostgreSQL", () => {
  assert.match(
    transitionMigration,
    /create or replace function public\.transition_action_decision\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  assert.match(
    transitionMigration,
    /membership\.role in \('admin', 'marketing', 'direction'\)/i,
  );
  const update = transitionMigration.indexOf("update public.actions");
  const statusGuard = transitionMigration.indexOf(
    "and status = v_expected_status",
    update,
  );
  const journal = transitionMigration.indexOf(
    "insert into public.journal",
    update,
  );
  assert.ok(update >= 0 && update < statusGuard);
  assert.ok(statusGuard < journal);
  assert.match(
    transitionMigration,
    /if not found then\s+return jsonb_build_object\('changed', false\)/i,
  );
  assert.match(
    transitionMigration,
    /revoke execute on function public\.transition_action_decision\([\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    transitionMigration,
    /grant execute on function public\.transition_action_decision\([\s\S]*to service_role/i,
  );
  assert.match(
    transitionMigration,
    /update public\.app_schema_version\s+set version = greatest\(version, 18\)/i,
  );
});

test("exécution — le claim transactionnel précède toute préparation", () => {
  assert.match(
    execution,
    /\.rpc\(\s*"claim_action_execution"[\s\S]*p_organization_id: orgId[\s\S]*p_action_id: actionId[\s\S]*p_actor_id: actorId[\s\S]*p_idempotency_key: idem/,
  );

  const claim = execution.indexOf('"claim_action_execution"');
  const parsed = execution.indexOf("readExecutionClaim(claimData)", claim);
  const adsPreparation = execution.indexOf("if (adsPause)", parsed);
  const outboxPreparation = execution.indexOf('.from("outbox_messages")', claim);

  assert.ok(claim >= 0 && claim < parsed);
  assert.ok(parsed < adsPreparation);
  assert.ok(parsed < outboxPreparation);
  assert.doesNotMatch(execution, /event: "execution_started"/);
  assert.doesNotMatch(execution, /\.update\(\{ idempotency_key: idem \}\)/);
});

test("exécution — le perdant et une reprise ambiguë échouent fermé", () => {
  assert.match(execution, /if \(!claim\)/);
  assert.match(execution, /if \(!claim\.claimed\)/);
  assert.match(execution, /claim_failed_recovery_required/);
  assert.match(execution, /claim_state_unavailable_recovery_required/);
});

test("migration exécution — garde org, claim et journal sont atomiques", () => {
  assert.match(
    transitionMigration,
    /create or replace function public\.claim_action_execution\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  const orgLock = transitionMigration.indexOf(
    "from public.organizations as organization",
  );
  const forUpdate = transitionMigration.indexOf("for update", orgLock);
  const pause = transitionMigration.indexOf("if v_paused then", forUpdate);
  const claim = transitionMigration.indexOf(
    "update public.actions as action",
    pause,
  );
  const journal = transitionMigration.indexOf(
    "insert into public.journal",
    claim,
  );
  assert.ok(orgLock >= 0 && orgLock < forUpdate);
  assert.ok(forUpdate < pause && pause < claim);
  assert.ok(claim < journal);
  assert.match(
    transitionMigration.slice(claim, journal),
    /action\.status = 'approved'[\s\S]*action\.idempotency_key is null/i,
  );
  assert.match(
    transitionMigration.slice(journal),
    /'execution_started'/,
  );
  assert.match(
    transitionMigration,
    /grant execute on function public\.claim_action_execution\([\s\S]*to service_role/i,
  );
});

test("exécution — chaque issue utilise la finalisation transactionnelle", () => {
  assert.match(
    execution,
    /async function finishExecution\([\s\S]*?\.rpc\(\s*"finish_action_execution"[\s\S]*?p_organization_id: orgId[\s\S]*?p_actor_id: actorId[\s\S]*?p_outcome: outcome[\s\S]*?\.finished === true/,
  );

  assert.doesNotMatch(execution, /\.update\(\{ status: "(?:executed|failed)" \}\)/);
  assert.doesNotMatch(execution, /event: "execution_(?:succeeded|failed)"/);

  const finishCalls = [...execution.matchAll(/await finishExecution\(/g)];
  assert.equal(finishCalls.length, 3, "deux succès et un échec");
  assert.equal(
    [...execution.matchAll(/idem,\s*"succeeded",/g)].length,
    2,
    "branches ads et relance",
  );
  assert.equal([...execution.matchAll(/idem,\s*"failed",/g)].length, 1);

  for (const call of finishCalls.slice(0, 2)) {
    const callIndex = call.index;
    const guard = execution.indexOf("if (!finished)", callIndex);
    const successReturn = execution.indexOf("return { ok: true", guard);
    assert.ok(callIndex < guard && guard < successReturn);
    assert.match(
      execution.slice(guard, successReturn),
      /execution_finalize_failed_recovery_required/,
    );
  }

  assert.match(
    execution,
    /if \(!failureRecorded\)[\s\S]*execution_failure_record_failed_recovery_required/,
  );
});

test("migration exécution — état final et journal partagent une transaction", () => {
  assert.match(
    transitionMigration,
    /create or replace function public\.finish_action_execution\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  const functionStart = transitionMigration.indexOf(
    "create or replace function public.finish_action_execution",
  );
  const update = transitionMigration.indexOf(
    "update public.actions",
    functionStart,
  );
  const claimGuard = transitionMigration.indexOf(
    "and idempotency_key = p_idempotency_key",
    update,
  );
  const journal = transitionMigration.indexOf(
    "insert into public.journal",
    claimGuard,
  );
  assert.ok(functionStart >= 0 && functionStart < update);
  assert.ok(update < claimGuard && claimGuard < journal);
  assert.match(
    transitionMigration.slice(functionStart, update),
    /when 'succeeded'[\s\S]*v_target_status := 'executed'[\s\S]*when 'failed'[\s\S]*v_target_status := 'failed'/i,
  );
  assert.match(
    transitionMigration,
    /grant execute on function public\.finish_action_execution\([\s\S]*to service_role/i,
  );
});

test("exécution — les lectures de préparation échouent fermé", () => {
  const prospectsRead = execution.indexOf(
    "const loadedProspects = await loadRelaunchProspects(",
  );
  const prospectsGuard = execution.indexOf(
    "if (!loadedProspects.ok)",
    prospectsRead,
  );
  const targeting = execution.indexOf(
    "dedupeByEmail(currentCohortRows)",
    prospectsRead,
  );
  assert.ok(prospectsRead >= 0 && prospectsRead < prospectsGuard);
  assert.ok(prospectsGuard < targeting);
  assert.match(
    execution.slice(prospectsGuard, targeting),
    /prospects_read_failed_recovery_required/,
  );
  assert.doesNotMatch(execution, /rows \?\? \[\]/);

  const countRead = execution.indexOf(
    "const { count: sentToday, error: countError }",
  );
  const countGuard = execution.indexOf(
    "if (countError || sentToday === null)",
    countRead,
  );
  const planning = execution.indexOf("planRecipients(targeted", countRead);
  assert.ok(countRead >= 0 && countRead < countGuard);
  assert.ok(countGuard < planning);
  assert.match(
    execution.slice(countGuard, planning),
    /outbox_count_failed_recovery_required/,
  );
  assert.doesNotMatch(execution, /sentToday \?\? 0/);
});

test("réglages — pause et autonomie délèguent à la même RPC atomique", () => {
  const cases = [
    {
      source: exportedFunctionSource(executionActions, "toggleExecutionPause"),
      control: "pause",
      value: "paused",
    },
    {
      source: exportedFunctionSource(agentActions, "setAutonomyLevel"),
      control: "autonomy",
      value: "level",
    },
  ];

  for (const item of cases) {
    assert.match(
      item.source,
      new RegExp(
        `await changeExecutionControl\\([\\s\\S]*"${item.control}",\\s*${item.value}`,
      ),
    );
    assert.doesNotMatch(item.source, /\.from\("organizations"\)/);
    assert.doesNotMatch(item.source, /\.from\("journal"\)/);
  }

  assert.match(
    executionControls,
    /\.rpc\(\s*"change_execution_control"[\s\S]*p_control: control[\s\S]*p_value: String\(value\)/,
  );
  assert.match(executionControls, /pause: "execution_pause"/);
  assert.match(executionControls, /autonomy: "autonomy"/);
  assert.match(executionControls, /_update_failed/);
  assert.match(executionControls, /_update_not_applied/);
});

test("migration réglages — garde d'organisation et journal sont atomiques", () => {
  assert.match(
    transitionMigration,
    /create or replace function public\.change_execution_control\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  const functionStart = transitionMigration.indexOf(
    "create or replace function public.change_execution_control",
  );
  const update = transitionMigration.indexOf(
    "update public.organizations",
    functionStart,
  );
  const journal = transitionMigration.indexOf(
    "insert into public.journal",
    update,
  );
  assert.ok(functionStart >= 0 && functionStart < update);
  assert.ok(update < journal);
  assert.match(
    transitionMigration.slice(functionStart, journal),
    /when 'pause'[\s\S]*execution_paused[\s\S]*when 'autonomy'[\s\S]*autonomy_level/i,
  );
  assert.match(
    transitionMigration,
    /grant execute on function public\.change_execution_control\([\s\S]*to service_role/i,
  );
});
