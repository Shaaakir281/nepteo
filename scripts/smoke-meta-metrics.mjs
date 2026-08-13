import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ACK = "I_ACKNOWLEDGE_META_METRICS_STAGING_WRITE";
const ORG_PREFIX = "E2E_META_METRICS_";

function required(name, preserve = false) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Variable requise absente : ${name}`);
  return preserve ? value : value.trim();
}

function noError(error, step) {
  if (error) throw new Error(`${step} : ${error.code ?? "erreur"} — ${error.message}`);
}

function snapshot(account, collectedAt, campaigns, rows) {
  return {
    version: 2,
    provider: "meta_ads",
    account,
    window_days: 7,
    observation_from: "2026-08-03",
    observation_to: "2026-08-09",
    attribution: { model: "requested_windows", windows: ["7d_click", "1d_view"] },
    quality: "complete",
    campaigns,
    rows,
    collected_at: collectedAt,
  };
}

async function main() {
  if (process.env.META_METRICS_STAGING_WRITE !== ACK) {
    throw new Error(`Écriture staging non autorisée. Posez META_METRICS_STAGING_WRITE=${ACK}.`);
  }
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("META_METRICS_SMOKE_EMAIL");
  const password = required("META_METRICS_SMOKE_PASSWORD", true);
  const orgId = required("META_METRICS_SMOKE_ORG_ID");
  const otherOrgId = required("META_METRICS_SMOKE_OTHER_ORG_ID");
  assert.notEqual(orgId, otherOrgId, "Les deux tenants doivent être distincts.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const user = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const auth = await user.auth.signInWithPassword({ email, password });
  noError(auth.error, "Authentification staging");
  assert.ok(auth.data.user, "Utilisateur staging absent.");
  const actorId = auth.data.user.id;

  const version = await admin.from("app_schema_version").select("version").eq("id", 1).single();
  noError(version.error, "Lecture version schéma");
  assert.ok(version.data.version >= 29, "La migration 0029 doit être appliquée avant le smoke.");
  const org = await admin.from("organizations").select("id,name").eq("id", orgId).single();
  noError(org.error, "Lecture organisation fixture");
  assert.ok(org.data.name.startsWith(ORG_PREFIX), `Organisation non dédiée (${ORG_PREFIX}* requis).`);
  const membership = await admin
    .from("memberships")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", actorId)
    .single();
  noError(membership.error, "Lecture membership fixture");
  assert.ok(["admin", "marketing", "direction"].includes(membership.data.role));
  const otherMembership = await admin
    .from("memberships")
    .select("role")
    .eq("organization_id", otherOrgId)
    .eq("user_id", actorId)
    .maybeSingle();
  noError(otherMembership.error, "Préflight membership tenant tiers");
  assert.equal(otherMembership.data, null, "L'utilisateur de recette ne doit pas appartenir au tenant tiers.");
  const collision = await admin
    .from("connectors")
    .select("id")
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads")
    .maybeSingle();
  noError(collision.error, "Préflight connecteur fixture");
  assert.equal(collision.data, null, "L'organisation dédiée doit être sans connecteur Meta Ads.");
  const otherRuns = await admin
    .from("ad_metric_sync_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", otherOrgId);
  noError(otherRuns.error, "Préflight tenant tiers");
  assert.ok((otherRuns.count ?? 0) > 0, "Le tenant tiers doit contenir au moins un run META-METRICS.");

  const connectorId = randomUUID();
  const account = { id: "act_900000000001", name: "Fixture Meta", currency: "EUR", timezone: "Europe/Paris" };
  const campaigns = [
    { id: "7001", name: "Fixture A", status: "ACTIVE", configured_status: "ACTIVE", objective: "OUTCOME_LEADS" },
    { id: "7002", name: "Fixture B", status: "PAUSED", configured_status: "PAUSED", objective: null },
  ];
  const firstRows = [
    { campaign_id: "7001", campaign_name: "Fixture A", date: "2026-08-08", impressions: 100, clicks: 5, spend: 12.5, results: [{ type: "lead", value: 2, source: "provider_reported" }] },
    { campaign_id: "7002", campaign_name: "Fixture B", date: "2026-08-08", impressions: 0, clicks: 0, spend: 0, results: [] },
  ];
  const firstAt = new Date().toISOString();
  const first = snapshot(account, firstAt, campaigns, firstRows);
  const secondAt = new Date(Date.now() + 1_000).toISOString();
  const second = snapshot(account, secondAt, campaigns.slice(0, 1), [
    { ...firstRows[0], spend: 15, results: [] },
  ]);
  let fixtureCreated = false;
  try {
    const inserted = await admin.from("connectors").insert({
      id: connectorId,
      organization_id: orgId,
      type: "ads",
      provider: "meta_ads",
      status: "connected",
      encrypted_credentials: "staging-fixture-no-secret",
      config: {
        connection: { consented_at: firstAt },
        meta_ad_account: account,
      },
    });
    noError(inserted.error, "Création connecteur éphémère");
    fixtureCreated = true;

    const args = (key, startedAt, value) => ({
      p_organization_id: orgId,
      p_connector_id: connectorId,
      p_actor_id: actorId,
      p_idempotency_key: `meta-metrics:${connectorId}:${key.repeat(64)}`,
      p_started_at: startedAt,
      p_snapshot: value,
    });
    const applied = await admin.rpc("apply_meta_metrics_snapshot", args("a", firstAt, first));
    noError(applied.error, "Première photographie");
    assert.equal(applied.data.replayed, false);
    assert.equal(applied.data.metrics, 2);
    const replay = await admin.rpc("apply_meta_metrics_snapshot", args("a", firstAt, first));
    noError(replay.error, "Rejeu idempotent");
    assert.equal(replay.data.replayed, true);

    const reconciled = await admin.rpc("apply_meta_metrics_snapshot", args("b", secondAt, second));
    noError(reconciled.error, "Réconciliation");
    assert.equal(reconciled.data.metrics, 1);
    const metrics = await admin
      .from("ad_metrics")
      .select("campaign_id,spend,conversions,revenue,outcome_provenance")
      .eq("organization_id", orgId)
      .eq("connector_id", connectorId);
    noError(metrics.error, "Contrôle photographie");
    assert.deepEqual(metrics.data, [{ campaign_id: "7001", spend: 15, conversions: null, revenue: null, outcome_provenance: null }]);
    const results = await admin.from("ad_metric_results").select("id").eq("organization_id", orgId);
    noError(results.error, "Contrôle suppression résultats");
    assert.equal(results.data.length, 0);

    const invalid = structuredClone(second);
    invalid.rows[0].campaign_name = "Nom incohérent";
    const rejected = await admin.rpc("apply_meta_metrics_snapshot", args("c", new Date(Date.now() + 2_000).toISOString(), invalid));
    assert.ok(rejected.error, "La photographie partielle doit être refusée.");
    const afterReject = await admin.from("ad_metrics").select("campaign_id,spend").eq("connector_id", connectorId);
    noError(afterReject.error, "Contrôle rollback");
    assert.deepEqual(afterReject.data, [{ campaign_id: "7001", spend: 15 }]);

    const failureArgs = {
      p_organization_id: orgId,
      p_connector_id: connectorId,
      p_actor_id: actorId,
      p_account_id: account.id,
      p_idempotency_key: `meta-metrics-failure:${"d".repeat(64)}`,
      p_started_at: new Date().toISOString(),
      p_quality: "partial",
      p_error_code: "partial_response",
    };
    const failure = await admin.rpc("record_meta_metrics_failure", failureArgs);
    noError(failure.error, "Journal échec");
    const failureReplay = await admin.rpc("record_meta_metrics_failure", failureArgs);
    noError(failureReplay.error, "Rejeu échec");
    assert.equal(failureReplay.data.replayed, true);

    const ownVisible = await user.from("ad_metric_sync_runs").select("id").eq("organization_id", orgId);
    noError(ownVisible.error, "Lecture RLS tenant propre");
    assert.ok(ownVisible.data.length >= 3);
    const otherVisible = await user.from("ad_metric_sync_runs").select("id").eq("organization_id", otherOrgId);
    noError(otherVisible.error, "Lecture RLS tenant tiers");
    assert.equal(otherVisible.data.length, 0);
    console.log("✓ Photographie atomique, rejeu, réconciliation, refus partiel et RLS vérifiés.");
  } finally {
    if (fixtureCreated) {
      const metricsCleanup = await admin.from("ad_metrics").delete().eq("connector_id", connectorId).eq("organization_id", orgId);
      noError(metricsCleanup.error, "Nettoyage métriques fixture");
      const connectorCleanup = await admin.from("connectors").delete().eq("id", connectorId).eq("organization_id", orgId);
      noError(connectorCleanup.error, "Nettoyage connecteur fixture");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
