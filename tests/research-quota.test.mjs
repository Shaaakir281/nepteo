import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/0017_research_daily_quota.sql",
    import.meta.url,
  ),
  "utf8",
);
const orchestration = await readFile(
  new URL("../lib/research/research.ts", import.meta.url),
  "utf8",
);

test("quota recherche — compteur quotidien distinct du cache et privé", () => {
  assert.match(
    migration,
    /create table public\.research_daily_usage[\s\S]*primary key \(organization_id, usage_date\)/i,
  );
  assert.match(
    migration,
    /alter table public\.research_daily_usage enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.research_daily_usage\s+from public, anon, authenticated, service_role/i,
  );
  assert.doesNotMatch(migration, /create policy[\s\S]*research_daily_usage/i);

  assert.doesNotMatch(
    orchestration,
    /\.from\("research_runs"\)[\s\S]{0,200}count:\s*"exact"/,
  );
  assert.doesNotMatch(orchestration, /startOfDayISO/);
});

test("quota recherche — la RPC réserve atomiquement et uniquement via service role", () => {
  assert.match(
    migration,
    /create or replace function public\.reserve_research_call\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  assert.match(
    migration,
    /insert into public\.research_daily_usage as usage[\s\S]*on conflict \(organization_id, usage_date\)[\s\S]*do update[\s\S]*reserved_calls = usage\.reserved_calls \+ 1[\s\S]*where usage\.reserved_calls < p_daily_limit/i,
  );
  assert.match(
    migration,
    /revoke execute on function public\.reserve_research_call\(uuid, integer\)\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.reserve_research_call\(uuid, integer\)\s+to service_role/i,
  );
  assert.doesNotMatch(migration, /reserved_calls\s*=\s*reserved_calls\s*-\s*1/i);
});

test("quota recherche — pause et réservation se sérialisent sur l'organisation", () => {
  const pauseRead = migration.indexOf(
    "select organization.execution_paused",
  );
  const organizationLock = migration.indexOf("for update", pauseRead);
  const quotaWrite = migration.indexOf(
    "insert into public.research_daily_usage as usage",
    pauseRead,
  );

  assert.notEqual(pauseRead, -1);
  assert.notEqual(organizationLock, -1);
  assert.notEqual(quotaWrite, -1);
  assert.ok(pauseRead < organizationLock);
  assert.ok(organizationLock < quotaWrite);
  assert.match(
    migration,
    /if v_paused then[\s\S]*'allowed', false[\s\S]*'reason', 'paused'[\s\S]*'used', coalesce\(v_used, 0\)/i,
  );
  assert.match(
    migration,
    /'allowed', false[\s\S]*'reason', 'daily_cap'[\s\S]*'used', coalesce\(v_used, p_daily_limit\)/i,
  );
  assert.match(
    migration,
    /'allowed', true[\s\S]*'reason', null[\s\S]*'used', v_used/i,
  );
});

test("quota recherche — backfill append-only et passage du schéma à 17", () => {
  assert.match(
    migration,
    /from public\.journal\s+where event = 'research_started'\s+group by organization_id, \(created_at at time zone 'UTC'\)::date/i,
  );
  assert.match(
    migration,
    /update public\.app_schema_version\s+set version = greatest\(version, 17\)/i,
  );
});

test("quota recherche — cache, réservation, journal puis appel payant", () => {
  const cacheGate = orchestration.indexOf("if (key && !args.force)");
  const reservation = orchestration.indexOf('"reserve_research_call"');
  const deniedReservation = orchestration.indexOf("if (!quota.allowed)");
  const startedJournal = orchestration.indexOf('event: "research_started"');
  const paidCall = orchestration.indexOf("await askResearch");

  assert.notEqual(cacheGate, -1);
  assert.notEqual(reservation, -1);
  assert.notEqual(deniedReservation, -1);
  assert.notEqual(startedJournal, -1);
  assert.notEqual(paidCall, -1);
  assert.ok(cacheGate < reservation);
  assert.ok(reservation < deniedReservation);
  assert.ok(deniedReservation < paidCall);
  assert.ok(reservation < startedJournal);
  assert.ok(startedJournal < paidCall);

  assert.match(
    orchestration,
    /if \(quotaError \|\| !quota\)[\s\S]*"quota_unavailable"[\s\S]*return \{ ok: false, reason: "quota_unavailable" \}/,
  );
  assert.match(
    orchestration,
    /if \(!quota\.allowed\)[\s\S]*recordBlocked\(admin, args, quota\.reason\)[\s\S]*return \{ ok: false, reason: quota\.reason \}/,
  );
  assert.doesNotMatch(orchestration, /\.select\("execution_paused"\)/);
  assert.doesNotMatch(orchestration, /release_research|decrement_research/);
});
