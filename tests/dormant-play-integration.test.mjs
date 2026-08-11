import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  dormantPlay,
  launcher,
  facade,
  draftTemplate,
  migration,
  prospects,
  execution,
  todayPage,
  todayScorecard,
  relaunchLoader,
  relaunchSnapshot,
] = await Promise.all([
  read("app/(cockpit)/_actions/dormant-play.ts"),
  read("app/(cockpit)/_components/dormant-play-launcher.tsx"),
  read("app/(cockpit)/actions.ts"),
  read("lib/draft-template.ts"),
  read("supabase/migrations/0020_value_events.sql"),
  read("app/(cockpit)/_actions/prospects.ts"),
  read("lib/execution.ts"),
  read("app/(cockpit)/page.tsx"),
  read("app/(cockpit)/_lib/today-scorecard-data.ts"),
  read("lib/relaunch-prospect-loader.ts"),
  read("lib/relaunch-snapshot.ts"),
]);

function sqlFunction(source, name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `fonction SQL absente : ${name}`);
  const next = source.indexOf("\ncreate or replace function public.", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `Server Action absente : ${name}`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("play dormant - le seuil est un choix explicite strict 30 ou 45 jours", () => {
  const proposal = functionBody(dormantPlay, "proposeDormantPlay");

  assert.match(
    dormantPlay,
    /function isDormantThreshold\([\s\S]{0,300}(?:===\s*30[\s\S]{0,120}===\s*45|===\s*45[\s\S]{0,120}===\s*30)/,
  );
  assert.match(proposal, /if \(!isDormantThreshold\(minSilenceDays\)\)/);
  assert.match(proposal, /reason:\s*"invalid_threshold"/);
  assert.doesNotMatch(
    dormantPlay,
    /(?:minSilenceDays|threshold|silenceDays)\s*(?:=|\?\?|\|\|)\s*(?:30|45)\b|\.default\(\s*(?:30|45)\s*\)/,
    "aucun seuil ne doit etre choisi implicitement",
  );
  assert.doesNotMatch(proposal, /buildFindings\(/);
});

test("play dormant - mutation serialisee, isolation demo et garde editeur", () => {
  const proposal = functionBody(dormantPlay, "proposeDormantPlay");

  assert.match(proposal, /getEditorContext\(\)/);
  assert.match(proposal, /if \(!ctx \|\| !ctx\.canEdit\)/);
  assert.match(proposal, /createAdminClient\(\)/);
  assert.match(proposal, /isDemoModeActive\(/);
  assert.match(
    proposal,
    /withDemoMutationLock\([\s\S]{0,180}ctx\.orgId,\s*"analysis"/,
  );
  assert.match(
    relaunchLoader,
    /\.from\("prospects"\)[\s\S]{0,1500}demo[\s\S]{0,120}\? query\.eq\("source",\s*DEMO_PROVIDER\)/,
    "en demo, les candidats doivent etre limites au provider demo",
  );
  assert.match(proposal, /loadRelaunchProspects\(admin,\s*ctx\.orgId,\s*demo\)/);
  assert.match(relaunchLoader, /MAX_RELAUNCH_PROSPECT_SCAN\s*=\s*20_000/);
  assert.match(relaunchLoader, /\.range\(offset,/);
  assert.match(
    relaunchLoader,
    /\.range\(\s*MAX_RELAUNCH_PROSPECT_SCAN,\s*MAX_RELAUNCH_PROSPECT_SCAN/,
  );
  assert.match(
    relaunchLoader,
    /\? query\.eq\("source",\s*DEMO_PROVIDER\)\s*:\s*query\.neq\("source",\s*DEMO_PROVIDER\)/,
  );
  assert.match(relaunchLoader, /last_contact_at,\s*synced_at/);
  assert.match(
    relaunchLoader,
    /\.order\("synced_at",\s*\{\s*ascending:\s*false\s*\}\)[\s\S]{0,100}\.order\("id",\s*\{\s*ascending:\s*false\s*\}\)/,
  );
  assert.doesNotMatch(relaunchLoader, /source\.is\.null/);
  assert.match(
    proposal,
    /payload:\s*\{[\s\S]{0,900}(?:demo\s*:\s*true|demo\s*\?)/,
    "l'action issue du jeu de demonstration doit rester identifiable",
  );

  const lock = proposal.indexOf("withDemoMutationLock(");
  const actionInsert = proposal.lastIndexOf('.from("actions")');
  assert.ok(lock >= 0 && actionInsert > lock);
});

test("play dormant - une action active est dedupliquee et les cohortes passees sont exclues", () => {
  const proposal = functionBody(dormantPlay, "proposeDormantPlay");

  assert.match(
    dormantPlay,
    /\.from\("actions"\)[\s\S]{0,500}\.eq\("kind",\s*"relaunch_dormant"\)/,
  );
  assert.match(
    dormantPlay,
    /ACTIVE_DORMANT_STATUSES\s*=\s*\[[\s\S]{0,150}"proposed"[\s\S]{0,150}"approved"/,
  );
  assert.match(
    proposal,
    /history\.actions\.find\([\s\S]{0,200}ACTIVE_DORMANT_STATUSES\.includes/,
  );
  assert.match(dormantPlay, /\.from\("action_target_snapshot_members"\)/);
  assert.match(dormantPlay, /\.in\("action_id",/);
  assert.match(dormantPlay, /new Set(?:<string>)?\(/);
  assert.match(proposal, /selectDormantProspects\(/);
  assert.match(proposal, /canonicalizeProspectCohort\(\s*loaded\.prospects/);
  assert.match(proposal, /priorEmails/);
  assert.match(proposal, /normalizedEmailKey/);

  const priorTargets = proposal.indexOf("loadPriorSnapshotProspectIds(");
  const selection = proposal.indexOf("selectDormantProspects(", priorTargets);
  const journal = proposal.indexOf('.from("journal")', selection);
  const actionInsert = proposal.lastIndexOf('.from("actions")', journal);

  assert.ok(priorTargets >= 0);
  assert.ok(selection > priorTargets);
  assert.ok(actionInsert > selection);
});

test("play dormant - cree seulement une proposition et sa trace, jamais un envoi", () => {
  const proposal = functionBody(dormantPlay, "proposeDormantPlay");
  const journal = proposal.indexOf('.from("journal")');
  const actionInsert = proposal.lastIndexOf('.from("actions")', journal);
  const insertedAction = proposal.slice(actionInsert, journal);

  assert.ok(actionInsert >= 0 && journal > actionInsert);
  assert.match(insertedAction, /kind:\s*"relaunch_dormant"/);
  assert.match(insertedAction, /status:\s*"proposed"/);
  assert.match(proposal.slice(journal), /dormant[\s_-]*play[\s_-]*proposed/i);
  assert.doesNotMatch(dormantPlay, /\.from\("outbox_messages"\)/);
  assert.doesNotMatch(
    dormantPlay,
    /executeApprovedAction\(|claim_action_execution|status:\s*"(?:prepared|sent|executed)"/,
  );
});

test("launcher - choix vide au depart, options 30/45 et promesse sans envoi", () => {
  assert.match(launcher, /useState(?:<[\s\S]{0,100}>)?\(\s*["']{2}\s*\)/);
  assert.match(launcher, /<option[^>]*value=["']["'][^>]*>/);
  assert.match(launcher, /<option[^>]*value=["']30["'][^>]*>/);
  assert.match(launcher, /<option[^>]*value=["']45["'][^>]*>/);
  assert.match(
    launcher,
    /(?:aucun|sans)[\s\S]{0,100}(?:message|envoi)|n(?:'|&apos;|’)[\s\S]{0,40}envoie/i,
  );
  assert.match(facade, /from "\.\/_actions\/dormant-play"/);
  assert.match(facade, /export async function \w*Dormant\w*\(/i);
});

test("relance dormant - approbation, preuve et selection aval reconnaissent le kind", () => {
  const approvalRpc = sqlFunction(
    migration,
    "approve_relaunch_action_with_targets",
  );
  const valueEventRpc = sqlFunction(migration, "record_value_event");
  const claimRpc = sqlFunction(migration, "claim_action_execution");
  const commercialSafeRpc = sqlFunction(
    migration,
    "is_commercial_safe_action_kind",
  );

  assert.match(draftTemplate, /kind === "relaunch_dormant"/);
  assert.match(approvalRpc, /'relaunch_dormant'/);
  assert.match(
    approvalRpc,
    /relaunch_dormant[\s\S]{0,300}approved_target_count[\s\S]{0,120}v_target_count/,
  );
  assert.match(valueEventRpc, /'relaunch_dormant'/);
  assert.ok(
    (claimRpc.match(/relaunch_dormant/g) ?? []).length >= 2,
    "le claim et sa branche d'échec doivent reconnaître le play dormant",
  );
  assert.match(commercialSafeRpc, /'relaunch_dormant'/);

  assert.match(prospects, /selectDormantProspects/);
  assert.match(prospects, /canonicalizeProspectCohort\(rows\)/);
  assert.match(prospects, /loadRelaunchProspects\(/);
  assert.match(prospects, /payload\.demo === true/);
  assert.match(prospects, /kind === "relaunch_dormant"/);
  assert.match(
    prospects,
    /const snapshotContacts = restrictCanonicalCohortToSnapshot\([\s\S]{0,180}contacts,[\s\S]{0,80}rawContacts,[\s\S]{0,80}snapshotIds[\s\S]{0,240}selectCurrentTargets\([\s\S]{0,120}snapshotContacts/,
  );
  const targetHelper = prospects.indexOf("function selectCurrentTargets(");
  const prospectSelection = prospects.indexOf(
    "selectDormantProspects(",
    targetHelper,
  );
  const prospectCap = prospects.indexOf(".slice(0, 50)", prospectSelection);
  assert.ok(
    targetHelper >= 0 &&
      prospectSelection > targetHelper &&
      prospectCap > prospectSelection,
  );

  assert.match(execution, /selectDormantProspects/);
  assert.match(
    execution,
    /const rawProspectRows = loadedProspects\.prospects[\s\S]{0,120}canonicalizeProspectCohort\(rawProspectRows\)/,
  );
  assert.match(execution, /loadRelaunchProspects\(/);
  assert.match(execution, /payload\.demo === true/);
  assert.match(execution, /kind === "relaunch_dormant"/);
  assert.match(execution, /\.from\("action_target_snapshots"\)/);
  assert.match(execution, /\.from\("action_target_snapshot_members"\)/);
  assert.match(execution, /restrictCanonicalCohortToSnapshot\(/);
  assert.match(relaunchSnapshot, /snapshotIds\.has\(row\.id\)/);
  assert.match(relaunchSnapshot, /snapshotIdByEmail/);
  assert.match(
    relaunchSnapshot,
    /snapshotId === row\.id \? row : \{ \.\.\.row, id: snapshotId \}/,
  );
  assert.match(
    execution,
    /!targetSnapshot && claimedAction\.kind === "relaunch_dormant"[\s\S]{0,180}target_snapshot_missing_recovery_required/,
  );
  assert.match(
    valueEventRpc,
    /v_action_kind = 'relaunch_dormant'[\s\S]{0,180}dormant outcome requires an action cohort/,
  );
  const executionSelection = execution.indexOf("selectDormantProspects(");
  const canonicalization = execution.indexOf(
    "canonicalizeProspectCohort(",
  );
  const snapshotRestriction = execution.indexOf(
    "restrictCanonicalCohortToSnapshot(",
  );
  const recipientPlanning = execution.indexOf(
    "planRecipients(",
    executionSelection,
  );
  assert.ok(
    canonicalization >= 0 &&
      canonicalization < snapshotRestriction &&
      snapshotRestriction < executionSelection,
    "la cohorte complète doit être canonicalisée avant l'intersection stricte du snapshot puis le cap dormant",
  );
  assert.ok(executionSelection >= 0 && recipientPlanning > executionSelection);
});

test("Today - expose le play et une scorecard reelle, non-demo et bornee", () => {
  assert.match(todayPage, /dormant-play-launcher/);
  assert.match(todayPage, /<DormantPlayLauncher\b/);
  assert.match(todayPage, /value-scorecard/);
  assert.match(todayScorecard, /buildValueScorecard\(/);
  assert.match(todayPage, /<ValueScorecard\b/);

  const queryStart = todayScorecard.indexOf('.from("value_events")');
  assert.notEqual(queryStart, -1);
  const query = todayScorecard.slice(queryStart, queryStart + 1_500);
  assert.match(query, /\.eq\("action_kind",\s*"relaunch_dormant"\)/);
  assert.match(query, /\.eq\("is_demo",\s*false\)/);
  assert.match(query, /\.range\(offset,\s*end\)/);
  assert.match(todayScorecard, /MAX_VALUE_SCORECARD_EVENTS\s*=\s*5000/);
  assert.match(todayPage, /valueScorecardIncomplete/);
  assert.match(todayPage, /valueScorecardReadFailed/);
});
