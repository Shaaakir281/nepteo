import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readComponentSources(names) {
  return (await Promise.all(names.map((name) =>
    readFile(new URL(`../app/(cockpit)/_components/${name}`, import.meta.url), "utf8"),
  ))).join("\n");
}

const migration = await readFile(
  new URL("../supabase/migrations/0020_value_events.sql", import.meta.url),
  "utf8",
);
const serverAction = await readFile(
  new URL(
    "../app/(cockpit)/_actions/value-events.ts",
    import.meta.url,
  ),
  "utf8",
);
const feedback = await readComponentSources([
  "action-value-feedback.tsx",
  "action-value-feedback-fields.tsx",
  "action-value-feedback-options.ts",
]);
const drawer = await readComponentSources([
  "validation-drawer.tsx",
  "validation-action-content.tsx",
]);

const tableStart = migration.indexOf("create table public.value_events");
const tableEnd = migration.indexOf(
  "create index value_events_org_occurred_idx",
  tableStart,
);
const tableDefinition = migration.slice(tableStart, tableEnd);

test("migration value events — stocke uniquement une preuve structurée et minimisée", () => {
  assert.notEqual(tableStart, -1);
  assert.match(
    tableDefinition,
    /organization_id uuid not null[\s\S]*action_id uuid[\s\S]*action_kind text not null[\s\S]*prospect_id uuid[\s\S]*event_type text not null[\s\S]*source text not null[\s\S]*is_demo boolean not null[\s\S]*false_positive_reason text[\s\S]*edit_level text[\s\S]*occurred_at timestamptz not null[\s\S]*actor_id uuid[\s\S]*idempotency_key text not null/i,
  );
  assert.match(tableDefinition, /'suggestion_useful'/);
  assert.match(tableDefinition, /'suggestion_not_useful'/);
  assert.match(tableDefinition, /'false_positive'/);
  assert.match(tableDefinition, /'manual_followup_sent'/);
  assert.match(tableDefinition, /'reply_received'/);
  assert.match(tableDefinition, /'meeting_booked'/);
  assert.match(tableDefinition, /'opportunity_created'/);
  assert.match(
    tableDefinition,
    /source in \('manual', 'gmail', 'microsoft'\)/i,
  );
  assert.match(
    tableDefinition,
    /event_type = 'false_positive'[\s\S]*false_positive_reason is not null[\s\S]*event_type <> 'false_positive'[\s\S]*false_positive_reason is null/i,
  );
  assert.match(
    tableDefinition,
    /event_type = 'draft_reviewed'[\s\S]*edit_level is not null[\s\S]*event_type <> 'draft_reviewed'[\s\S]*edit_level is null/i,
  );
  assert.doesNotMatch(
    tableDefinition,
    /\b(email|address|subject|body|comment|payload|metadata|content)\b/i,
  );
});

test("migration value events — lie action et prospect au même tenant sans bloquer l'effacement", () => {
  assert.match(
    migration,
    /foreign key \(action_id, organization_id\)[\s\S]*references public\.actions\(id, organization_id\)[\s\S]*on delete set null \(action_id\)/i,
  );
  assert.match(
    migration,
    /foreign key \(prospect_id, organization_id\)[\s\S]*references public\.prospects\(id, organization_id\)[\s\S]*on delete set null \(prospect_id\)/i,
  );
  assert.doesNotMatch(migration, /create trigger[\s\S]*value_events/i);
  assert.match(
    migration,
    /insert into public\.value_events \([\s\S]*action_kind[\s\S]*v_action_kind/i,
  );
  assert.match(
    migration,
    /v_existing\.action_kind is distinct from v_action_kind/i,
  );
  assert.match(
    migration,
    /value_events_org_kind_occurred_idx[\s\S]*action_kind[\s\S]*is_demo/i,
  );
});

test("migration value events — RLS en lecture métier, mutations via service role sans UPDATE", () => {
  assert.match(
    migration,
    /alter table public\.value_events enable row level security/i,
  );
  assert.match(
    migration,
    /create policy value_events_select[\s\S]*for select[\s\S]*has_org_role\([\s\S]*array\['admin', 'marketing', 'direction'\]/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.value_events from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select on table public\.value_events to authenticated/i,
  );
  assert.match(
    migration,
    /revoke update on table public\.value_events from service_role[\s\S]*grant select, insert, delete on table public\.value_events to service_role/i,
  );
  assert.match(
    migration,
    /has_table_privilege\([\s\S]*'service_role'[\s\S]*'UPDATE'[\s\S]*found unsafe table privileges/i,
  );
});

test("migration value events — RPC garde le rôle, le tenant et les combinaisons", () => {
  assert.match(
    migration,
    /create or replace function public\.record_value_event\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  assert.match(
    migration,
    /membership\.organization_id = p_organization_id[\s\S]*membership\.user_id = p_actor_id[\s\S]*membership\.role in \('admin', 'marketing', 'direction'\)/i,
  );
  assert.match(
    migration,
    /from public\.actions as action[\s\S]*action\.id = p_action_id[\s\S]*action\.organization_id = p_organization_id/i,
  );
  assert.match(
    migration,
    /select[\s\S]*action\.kind,[\s\S]*action\.status,[\s\S]*action\.payload,[\s\S]*action\.payload @> '\{"demo": true\}'::jsonb[\s\S]*into v_action_kind, v_action_status, v_action_payload, v_is_demo/i,
  );
  assert.match(
    migration,
    /p_event_type in \([\s\S]*'draft_reviewed'[\s\S]*'manual_followup_sent'[\s\S]*'reply_received'[\s\S]*'meeting_booked'[\s\S]*'opportunity_created'[\s\S]*v_action_kind = 'relaunch_priority'[\s\S]*left\(v_action_kind, 15\) = 'relaunch_stage_'[\s\S]*value event incompatible with action kind/i,
  );
  assert.match(
    migration,
    /from public\.prospects as prospect[\s\S]*prospect\.id = p_prospect_id[\s\S]*prospect\.organization_id = p_organization_id/i,
  );
  assert.match(
    migration,
    /p_event_type in \([\s\S]*'manual_followup_sent'[\s\S]*p_prospect_id is null[\s\S]*v_action_status not in \('approved', 'executed'\)[\s\S]*declared outcome requires an approved prospect/i,
  );
  assert.match(
    migration,
    /from public\.action_target_snapshots[\s\S]*from public\.action_target_snapshot_members[\s\S]*member\.prospect_id = p_prospect_id[\s\S]*declared outcome outside action cohort/i,
  );
  assert.match(
    migration,
    /p_event_type = 'false_positive'[\s\S]*p_false_positive_reason is null/i,
  );
  assert.match(
    migration,
    /p_event_type = 'draft_reviewed'[\s\S]*p_edit_level is null/i,
  );
  assert.match(
    migration,
    /p_event_type not in \([\s\S]*'reply_received'[\s\S]*p_source <> 'manual'/i,
  );
  assert.match(
    migration,
    /revoke execute on function public\.record_value_event\([\s\S]*from public, anon, authenticated[\s\S]*grant execute on function public\.record_value_event\([\s\S]*to service_role/i,
  );
});

test("migration value events — replay identique sans double journal, conflit de payload fermé", () => {
  const insert = migration.indexOf("insert into public.value_events");
  const conflict = migration.indexOf(
    "on conflict (organization_id, idempotency_key) do nothing",
    insert,
  );
  const replayRead = migration.indexOf(
    "select *",
    conflict,
  );
  const payloadConflict = migration.indexOf(
    "value event idempotency payload conflict",
    replayRead,
  );
  const journal = migration.indexOf("insert into public.journal", conflict);

  assert.ok(insert >= 0 && insert < conflict);
  assert.ok(conflict < replayRead && replayRead < payloadConflict);
  assert.ok(payloadConflict < journal);
  assert.match(
    migration.slice(replayRead, journal),
    /action_id is distinct from p_action_id[\s\S]*prospect_id is distinct from p_prospect_id[\s\S]*event_type is distinct from p_event_type[\s\S]*is_demo is distinct from v_is_demo[\s\S]*actor_id is distinct from p_actor_id/i,
  );
  assert.match(
    migration,
    /'value_event_recorded'[\s\S]*jsonb_strip_nulls\([\s\S]*'event_type'[\s\S]*'source'[\s\S]*'is_demo'[\s\S]*'false_positive_reason'[\s\S]*'edit_level'/i,
  );
  assert.doesNotMatch(
    migration,
    /(insert\s+into|update|delete\s+from)\s+public\.outbox_messages/i,
  );
});

test("migration value events — version 19 exigée avant certification 20", () => {
  const prerequisite = migration.indexOf("do $value_events_prerequisites$");
  const table = migration.indexOf("create table public.value_events");
  const versionUpdate = migration.indexOf(
    "update public.app_schema_version",
    table,
  );

  assert.ok(prerequisite >= 0 && prerequisite < table);
  assert.match(
    migration.slice(prerequisite, table),
    /app_schema_version[\s\S]*id = 1[\s\S]*version >= 19[\s\S]*requires schema version 19/i,
  );
  assert.match(
    migration.slice(versionUpdate),
    /greatest\(version, 20\)[\s\S]*where id = 1[\s\S]*version >= 19/i,
  );
  assert.doesNotMatch(migration, /values \(1, 20\)/i);
});

test("action value events — garde canEdit, force manual et ne touche jamais l'outbox", () => {
  assert.match(serverAction, /if \(!ctx \|\| !ctx\.canEdit\)/);
  assert.match(
    serverAction,
    /\.from\("actions"\)[\s\S]*\.eq\("id", parsed\.value\.actionId\)[\s\S]*\.eq\("organization_id", ctx\.orgId\)/,
  );
  assert.match(
    serverAction,
    /\.from\("prospects"\)[\s\S]*\.eq\("id", parsed\.value\.prospectId\)[\s\S]*\.eq\("organization_id", ctx\.orgId\)/,
  );
  assert.match(
    serverAction,
    /validateValueEventInput\(\{ \.\.\.input, source: "manual" \}\)/,
  );
  assert.match(serverAction, /p_source: "manual"/);
  assert.match(serverAction, /\.rpc\("record_value_event"/);
  assert.match(serverAction, /revalidatePath\("\/"\)/);
  assert.doesNotMatch(
    serverAction,
    /\.from\("outbox_messages"\)|status:\s*"sent"/,
  );
});

test("interface value events — couvre verdict, retouche, résultats et explicite le déclaratif", () => {
  for (const token of [
    "suggestion_useful",
    "suggestion_not_useful",
    "false_positive",
    "draft_reviewed",
    "manual_followup_sent",
    "reply_received",
    "meeting_booked",
    "opportunity_created",
  ]) {
    assert.ok(feedback.includes(token), `contrôle absent : ${token}`);
  }
  assert.match(feedback, /mode = "all"/);
  assert.match(feedback, /const showDraft = mode === "all" \|\| includeDraft/);
  assert.match(feedback, /n&apos;envoient aucun message/);
  assert.match(feedback, /ne changent jamais le statut de[\s\S]*outbox/);
  assert.match(feedback, /aria-live="polite"/);
  assert.match(feedback, /pendingSubmission/);
  assert.match(feedback, /crypto\.randomUUID\(\)/);
  assert.match(
    drawer,
    /function CampaignContent[\s\S]*canEdit && <ActionValueFeedback[\s\S]*mode="evaluation"/,
  );
  assert.match(
    drawer,
    /<ProspectDrafts[\s\S]*<ActionValueFeedback[\s\S]*mode="evaluation"[\s\S]*includeDraft/,
  );
  assert.doesNotMatch(
    drawer,
    /mode="outcomes"|mode="all"/,
  );
});
