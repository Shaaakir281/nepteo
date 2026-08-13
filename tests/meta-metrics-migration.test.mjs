import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/0029_meta_metrics.sql", import.meta.url),
  "utf8",
);

const applyStart = migration.indexOf("create or replace function public.apply_meta_metrics_snapshot");
const failureStart = migration.indexOf("create or replace function public.record_meta_metrics_failure");
const applyFunction = migration.slice(applyStart, failureStart);
const failureEnd = migration.indexOf("revoke execute on function public.apply_meta_metrics_snapshot", failureStart);
const failureFunction = migration.slice(failureStart, failureEnd);

test("META-METRICS migration — les inconnues restent NULL et la provenance est explicite", () => {
  assert.match(migration, /alter column conversions drop not null[\s\S]*alter column conversions drop default/i);
  assert.match(migration, /alter column revenue drop not null[\s\S]*alter column revenue drop default/i);
  assert.match(migration, /metric_provenance text not null[\s\S]*outcome_provenance text[\s\S]*data_quality text not null/i);
  assert.match(migration, /currency text[\s\S]*account_timezone text[\s\S]*attribution_model text[\s\S]*attribution_windows text\[\]/i);
  assert.match(migration, /conversions is null and revenue is null and outcome_provenance is null/i);
  assert.match(applyFunction, /spend, conversions, revenue,[\s\S]*\(v_row ->> 'spend'\)::numeric, null, null/i);
  assert.doesNotMatch(applyFunction, /\b(roas|cac)\b/i);
});

test("META-METRICS migration — l'identité et les résultats Meta sont réconciliables", () => {
  assert.match(migration, /ad_metrics_provider_identity_uidx[\s\S]*organization_id, provider, account_id, campaign_id, date/i);
  assert.match(migration, /create table public\.ad_metric_results[\s\S]*result_type text not null[\s\S]*result_source text not null/i);
  assert.match(migration, /foreign key \(ad_metric_id, organization_id\)[\s\S]*references public\.ad_metrics\(id, organization_id\)/i);
  assert.match(migration, /unique \(ad_metric_id, result_type, attribution_model, attribution_windows\)/i);
  assert.match(applyFunction, /delete from public\.ad_campaigns[\s\S]*insert into public\.ad_campaigns/i);
  assert.match(applyFunction, /delete from public\.ad_metrics[\s\S]*date between v_from and v_to[\s\S]*insert into public\.ad_metrics/i);
  assert.match(applyFunction, /provider_reported[\s\S]*requested_windows[\s\S]*array\['7d_click', '1d_view'\]/i);
});

test("META-METRICS migration — la photographie complète est atomique et idempotente", () => {
  assert.ok(applyStart >= 0 && failureStart > applyStart);
  assert.match(applyFunction, /security definer[\s\S]*set search_path = ''/i);
  assert.match(applyFunction, /where organization_id = p_organization_id and idempotency_key = p_idempotency_key[\s\S]*'replayed', true/i);
  assert.match(migration, /campaign_count integer[\s\S]*between 0 and 500/i);
  assert.match(migration, /metric_count integer[\s\S]*between 0 and 5000/i);
  assert.match(applyFunction, /raise exception[\s\S]*stale snapshot/i);
  assert.match(applyFunction, /insert into public\.ad_metric_sync_runs[\s\S]*delete from public\.ad_campaigns[\s\S]*delete from public\.ad_metrics[\s\S]*insert into public\.journal/i);
  assert.match(applyFunction, /meta_ads_metrics_snapshot_applied/i);
});

test("META-METRICS migration — un échec n'altère jamais la photographie précédente", () => {
  assert.match(failureFunction, /quality not in \('partial', 'unavailable'\)/i);
  assert.match(failureFunction, /insert into public\.ad_metric_sync_runs/i);
  assert.match(failureFunction, /meta_ads_metrics_sync_failed/i);
  assert.doesNotMatch(failureFunction, /(insert into|update|delete from) public\.ad_metrics/i);
  assert.doesNotMatch(failureFunction, /(insert into|update|delete from) public\.ad_campaigns/i);
  assert.equal((failureFunction.match(/insert into public\.journal/gi) ?? []).length, 1);
});

test("META-METRICS migration — RLS isole les tenants et les RPC sont service_role seulement", () => {
  for (const table of ["ad_metric_sync_runs", "ad_campaigns", "ad_metric_results"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`create policy ${table}_select[\\s\\S]*has_org_role\\(organization_id`, "i"));
  }
  assert.match(migration, /revoke execute on function public\.apply_meta_metrics_snapshot[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i);
  assert.match(migration, /revoke execute on function public\.record_meta_metrics_failure[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i);
  assert.match(applyFunction, /m\.organization_id = p_organization_id[\s\S]*m\.user_id = p_actor_id/i);
  assert.doesNotMatch(migration, /organization_members/i);
});

test("META-METRICS migration — versionne 28 vers 29 sans saut implicite", () => {
  const versionUpdate = migration.indexOf("update public.app_schema_version");
  assert.match(migration.slice(0, applyStart), /version >= 28[\s\S]*requires schema version 28/i);
  assert.match(migration.slice(versionUpdate), /greatest\(version, 29\)[\s\S]*version >= 29/i);
  assert.doesNotMatch(migration, /values \(1, 29\)/i);
});
