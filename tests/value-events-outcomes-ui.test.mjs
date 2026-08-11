import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [history, outcomes, feedbackShell, feedbackFields, prospects, decisions, queueData, migration] =
  await Promise.all([
  read("app/(cockpit)/_components/decisions-history.tsx"),
  read("app/(cockpit)/_components/action-outcomes.tsx"),
  read("app/(cockpit)/_components/action-value-feedback.tsx"),
  read("app/(cockpit)/_components/action-value-feedback-fields.tsx"),
  read("app/(cockpit)/_actions/prospects.ts"),
  read("app/(cockpit)/_actions/decisions.ts"),
  read("app/(cockpit)/_lib/today-queue-data.ts"),
  read("supabase/migrations/0020_value_events.sql"),
  ]);

const feedback = `${feedbackShell}\n${feedbackFields}`;

test("les résultats terrain restent séparés par prospect et après décision", () => {
  assert.match(history, /isRelanceKind\(a\.kind\)/);
  assert.match(
    history,
    /a\.status === "approved" \|\| a\.status === "executed"/,
  );
  assert.match(
    history,
    /<ActionOutcomesDisclosure actionId=\{a\.id\} \/>/,
  );
  assert.match(outcomes, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(
    outcomes,
    /\{open && \([\s\S]*<ActionOutcomes actionId=\{actionId\} \/>/,
  );
  assert.match(outcomes, /prospectId=\{prospect\.id\}/);
  assert.match(outcomes, /mode="outcomes"/);
  assert.match(outcomes, /prospectsForAction\(actionId\)/);
  assert.match(feedback, /window\.confirm\(/);
  assert.match(feedback, /recordedOutcomes\.has\(outcome\.value\)/);
  assert.match(feedback, /ne constitue pas une preuve fournisseur/);
});

test("la cohorte et l'historique terrain sont bornés à 50", () => {
  assert.match(prospects, /\.slice\(0, 50\)/);

  const decidedQuery = queueData.indexOf("const { data: decidedRows }");
  const decidedLimit = queueData.indexOf(".limit(50)", decidedQuery);
  assert.ok(decidedQuery >= 0);
  assert.ok(decidedLimit > decidedQuery);
});

test("la cohorte de relance est figée atomiquement avec l'approbation", () => {
  assert.match(migration, /create table public\.action_target_snapshots/);
  assert.match(
    migration,
    /create table public\.action_target_snapshot_members/,
  );
  assert.match(
    migration,
    /action_target_members_prospect_organization_fkey[\s\S]*foreign key \(prospect_id, organization_id\)/,
  );
  assert.match(
    migration,
    /create or replace function public\.approve_relaunch_action_with_targets\([\s\S]*security definer[\s\S]*cardinality\(p_prospect_ids\) > 50/,
  );
  assert.match(migration, /cardinality\(p_prospect_ids\) = 0/);
  assert.match(
    migration,
    /membership\.role in \('admin', 'marketing', 'direction'\)/,
  );

  const cohortInsert = migration.indexOf(
    "insert into public.action_target_snapshots",
  );
  const approvalUpdate = migration.indexOf(
    "update public.actions",
    cohortInsert,
  );
  const decisionJournal = migration.indexOf(
    "'action_approved'",
    approvalUpdate,
  );
  assert.ok(cohortInsert >= 0);
  assert.ok(approvalUpdate > cohortInsert);
  assert.ok(decisionJournal > approvalUpdate);

  assert.match(
    prospects,
    /\.rpc\(\s*"approve_relaunch_action_with_targets"/,
  );
  assert.match(prospects, /\.from\("action_target_snapshots"\)/);
  assert.match(prospects, /\.from\("action_target_snapshot_members"\)/);
  assert.match(decisions, /approveRelaunchWithTargetSnapshot\(id\)/);
  assert.match(
    decisions,
    /if \(relaunchApproval\.handled\)[\s\S]*relaunchApproval\.changed \? "\/\?walkthrough=decision" : "\/"/,
  );
});

test("les décisions historiques gardent un fallback opérationnel", () => {
  assert.match(prospects, /action\.status !== "proposed"/);
  assert.match(prospects, /\.from\("outbox_messages"\)/);
  assert.match(prospects, /\.from\("value_events"\)/);
  assert.match(prospects, /Object\.keys\(drafts\)/);
});
