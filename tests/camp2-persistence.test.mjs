import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/0027_campaign_decision_cockpit.sql",
    import.meta.url,
  ),
  "utf8",
);

function sqlFunction(name) {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `fonction SQL absente : ${name}`);
  const end = migration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `fin de fonction SQL absente : ${name}`);
  return migration.slice(start, end + 4);
}

test("CAMP-2 persistance — prérequis 26 et readiness additive 27", () => {
  assert.match(
    migration,
    /app_schema_version[\s\S]*version >= 26[\s\S]*requires schema version 26/i,
  );
  assert.match(
    migration,
    /update public\.app_schema_version\s+set version = greatest\(version, 27\)/i,
  );
  assert.match(
    migration,
    /app_schema_version[\s\S]*version >= 27[\s\S]*did not certify schema version 27/i,
  );
});

test("CAMP-2 décisions — colonne nullable, nettoyée et bornée", () => {
  assert.match(
    migration,
    /alter table public\.actions\s+add column if not exists decision_reason text/i,
  );
  assert.match(
    migration,
    /actions_decision_reason_check[\s\S]*decision_reason is null[\s\S]*decision_reason = btrim\(decision_reason\)[\s\S]*char_length\(decision_reason\) between 3 and 500/i,
  );
});

test("CAMP-2 décisions — v2 garde le rôle éditeur et impose le motif au refus", () => {
  const source = sqlFunction("transition_action_decision_v2");
  assert.match(source, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    source,
    /membership\.role in \('admin', 'marketing', 'direction'\)/i,
  );
  assert.match(
    source,
    /v_reason := nullif\([\s\S]*regexp_replace\([\s\S]*regexp_replace\(coalesce\(p_reason, ''\), '\[\[:cntrl:\]\]'[\s\S]*'\[\[:space:\]\]\+'/i,
  );
  assert.match(
    source,
    /p_transition = 'reject'[\s\S]*v_reason is null[\s\S]*char_length\(v_reason\) not between 3 and 500/i,
  );
  assert.match(
    source,
    /decision_reason = case[\s\S]*when p_transition = 'resume' then null[\s\S]*else v_reason/i,
  );
});

test("CAMP-2 décisions — changement et raison journalisée sont atomiques", () => {
  const source = sqlFunction("transition_action_decision_v2");
  const update = source.indexOf("update public.actions");
  const compareAndSet = source.indexOf("and status = v_expected_status", update);
  const journal = source.indexOf("insert into public.journal", compareAndSet);
  assert.ok(update >= 0 && update < compareAndSet && compareAndSet < journal);
  assert.match(
    source.slice(journal),
    /jsonb_build_object\([\s\S]*'reason', v_action\.decision_reason/i,
  );
  assert.match(
    source,
    /if not found then\s+return jsonb_build_object\('changed', false\)/i,
  );
});

test("CAMP-2 décisions — l'ancienne RPC reste disponible", () => {
  assert.match(
    migration,
    /to_regprocedure\(\s*'public\.transition_action_decision\(uuid,uuid,uuid,text\)'\s*\) is null/i,
  );
  const legacy = sqlFunction("transition_action_decision");
  assert.match(
    legacy,
    /p_transition = 'reject'[\s\S]*rejection reason required[\s\S]*transition_action_decision_v2/i,
  );
  assert.match(
    migration,
    /revoke execute on function public\.transition_action_decision_v2\([\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i,
  );
});

test("CAMP-2 propositions — unicité partielle des pauses ouvertes", () => {
  assert.match(
    migration,
    /campaign_decision_duplicate_preflight[\s\S]*status = 'proposed'[\s\S]*left\(action\.kind, 10\) = 'ads_pause_'[\s\S]*having count\(\*\) > 1[\s\S]*duplicate proposed ads pause actions require explicit arbitration[\s\S]*Keep or decide each duplicate explicitly/i,
  );
  const preflight = migration.indexOf("do $campaign_decision_duplicate_preflight$");
  const uniqueIndex = migration.indexOf("create unique index if not exists", preflight);
  assert.ok(preflight >= 0 && preflight < uniqueIndex);
  assert.match(
    migration,
    /create unique index if not exists\s+actions_one_proposed_ads_pause_kind_per_org_uidx\s+on public\.actions \(organization_id, kind\)\s+where status = 'proposed'\s+and left\(kind, 10\) = 'ads_pause_'/i,
  );
});

test("CAMP-2 propositions — les actions legacy sont adoptées et tracées sans effet externe", () => {
  const source = sqlFunction("propose_ads_pause_actions");
  assert.match(
    source,
    /if v_existing\.confidence is not null then[\s\S]*v_existing\.status = 'proposed'[\s\S]*update public\.actions as action[\s\S]*confidence = null[\s\S]*payload = v_payload/i,
  );
  assert.match(
    source,
    /else\s+update public\.actions as action\s+set confidence = null/i,
  );
  assert.match(
    source,
    /insert into public\.journal[\s\S]*'action_proposal_upgraded'[\s\S]*'action_history_adopted'[\s\S]*'external_effect', false[\s\S]*where not exists/i,
  );
  assert.match(
    source,
    /'created', false,[\s\S]*'upgraded',[\s\S]*'adopted',[\s\S]*continue/i,
  );
});

test("CAMP-2 propositions — lot borné, champs exacts et payload Meta strict", () => {
  const source = sqlFunction("propose_ads_pause_actions");
  assert.match(source, /jsonb_typeof\(p_proposals\) is distinct from 'array'/i);
  assert.match(source, /jsonb_array_length\(p_proposals\) not between 1 and 20/i);
  assert.match(
    source,
    /jsonb_array_elements\(p_proposals\)[\s\S]*order by proposal\.value ->> 'kind'/i,
  );
  assert.match(source, /v_item \?& array\[[\s\S]*'confidence'[\s\S]*'payload'/i);
  assert.match(source, /v_item - array\[[\s\S]*'confidence'[\s\S]*'payload'[\s\S]*<> '\{\}'::jsonb/i);
  assert.match(source, /jsonb_typeof\(v_item -> 'confidence'\) is distinct from 'null'/i);
  assert.match(source, /\(v_item ->> 'risk'\) <> 'low'/i);
  assert.match(
    source,
    /v_payload \?& array\[[\s\S]*'campaign_id'[\s\S]*'campaign_name'[\s\S]*'roas'[\s\S]*'spend'[\s\S]*'revenue'[\s\S]*'provider'/i,
  );
  assert.match(source, /\(v_payload ->> 'provider'\) <> 'meta_ads'/i);
  assert.match(source, /'ads_pause_' \|\| v_campaign_id/i);
  assert.match(source, /v_server_roas := round\(v_revenue \/ v_spend, 2\)/i);
  assert.match(source, /if v_server_roas >= 1[\s\S]*abs\(v_roas - v_server_roas\) > 0\.01/i);
  assert.match(source, /abs\(v_roas - v_server_roas\) > 0\.01/i);
  assert.match(
    source,
    /jsonb_set\(v_payload, '\{spend\}'[\s\S]*jsonb_set\(v_payload, '\{revenue\}'[\s\S]*jsonb_set\(v_payload, '\{roas\}'/i,
  );
  assert.match(
    source,
    /v_payload \?& array\[[\s\S]*'observation_from'[\s\S]*'observation_to'/i,
  );
  assert.match(
    source,
    /v_observation_to - v_observation_from <> 29[\s\S]*v_observation_to > current_date/i,
  );
});

test("CAMP-2 propositions — rôle, idempotence et journal sont transactionnels", () => {
  const source = sqlFunction("propose_ads_pause_actions");
  assert.match(
    source,
    /membership\.role in \('admin', 'marketing', 'direction'\)/i,
  );
  const insert = source.indexOf("insert into public.actions");
  const conflict = source.indexOf("on conflict (organization_id, kind)", insert);
  const journal = source.indexOf("insert into public.journal", conflict);
  assert.ok(insert >= 0 && insert < conflict && conflict < journal);
  assert.match(
    source.slice(insert, conflict),
    /null,[\s\S]*'low',[\s\S]*'proposed'/i,
  );
  assert.match(
    source.slice(conflict, journal),
    /do nothing[\s\S]*v_existing\.payload is distinct from v_payload[\s\S]*idempotency content conflict/i,
  );
  assert.match(source.slice(journal), /'action_proposed'[\s\S]*'confidence', null/i);
});

test("CAMP-2 propositions — une décision passée bloque durablement la répétition", () => {
  const source = sqlFunction("propose_ads_pause_actions");
  const historyRead = source.indexOf("from public.actions as action");
  const insert = source.indexOf("insert into public.actions", historyRead);
  assert.ok(historyRead >= 0 && historyRead < insert);
  assert.match(
    source.slice(historyRead, insert),
    /action\.kind = \(v_item ->> 'kind'\)[\s\S]*for update[\s\S]*v_existing\.status = 'proposed'[\s\S]*'created', false[\s\S]*continue/i,
  );
  assert.match(
    source.slice(0, historyRead),
    /pg_advisory_xact_lock\([\s\S]*hashtextextended\([\s\S]*p_organization_id::text[\s\S]*v_item ->> 'kind'/i,
  );
});

test("CAMP-2 propositions — accès service-role seulement, sans effet externe", () => {
  const source = sqlFunction("propose_ads_pause_actions");
  assert.match(source, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    migration,
    /revoke execute on function public\.propose_ads_pause_actions\([\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i,
  );
  assert.doesNotMatch(source, /outbox_messages|http_request|net\.http|status\s*=\s*'executed'|status\s*=\s*'sent'/i);
});

test("CAMP-2 non-exécution — le claim conserve les relances et exclut toute pause Ads", () => {
  const source = sqlFunction("claim_action_execution");
  assert.match(source, /p_idempotency_key is distinct from \('exec:' \|\| p_action_id::text\)/i);
  assert.match(source, /from public\.organizations as organization[\s\S]*for update/i);
  assert.match(source, /action\.status = 'approved'[\s\S]*action\.idempotency_key is null/i);
  assert.match(source, /action\.kind = 'relaunch_priority'/i);
  assert.match(source, /action\.kind = 'relaunch_dormant'/i);
  assert.match(source, /left\(action\.kind, 15\) = 'relaunch_stage_'/i);
  assert.doesNotMatch(source, /ads_pause_/i);
  assert.match(source, /'not_executable'/i);
  assert.match(source, /insert into public\.journal[\s\S]*'execution_started'/i);
});

test("CAMP-2 non-exécution — la finalisation exclut aussi tout ancien claim Ads", () => {
  const source = sqlFunction("finish_action_execution");
  assert.match(source, /action\.status = 'approved'[\s\S]*action\.idempotency_key = p_idempotency_key/i);
  assert.match(source, /action\.kind = 'relaunch_priority'/i);
  assert.match(source, /action\.kind = 'relaunch_dormant'/i);
  assert.match(source, /left\(action\.kind, 15\) = 'relaunch_stage_'/i);
  assert.doesNotMatch(source, /ads_pause_/i);
  assert.match(source, /if not found then\s+return jsonb_build_object\('finished', false\)/i);
  assert.match(source, /insert into public\.journal[\s\S]*v_event/i);
  assert.match(
    migration,
    /revoke execute on function public\.finish_action_execution\([\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i,
  );
});

test("CAMP-2 postconditions — privilèges et absence d'exécution sont vérifiés avant readiness", () => {
  const postconditions = migration.indexOf("do $campaign_decision_postconditions$");
  const readinessUpdate = migration.indexOf("update public.app_schema_version", postconditions);
  assert.ok(postconditions >= 0 && postconditions < readinessUpdate);
  assert.match(
    migration.slice(postconditions, readinessUpdate),
    /position\('ads_pause_' in v_claim_definition\) > 0[\s\S]*position\('ads_pause_' in v_finish_definition\) > 0[\s\S]*has_function_privilege[\s\S]*authenticated[\s\S]*service_role/i,
  );
});
