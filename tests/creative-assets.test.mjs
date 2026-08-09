import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  creativeAssetFromRow,
  creativeLimitMessage,
  creativeReservationResult,
  recordedCreativeResult,
} from "../lib/creative-asset-rules.ts";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/0028_creative_assets.sql", import.meta.url),
  "utf8",
);

test("creative assets — parse strictement réservation, enregistrement et ligne", () => {
  assert.deepEqual(
    creativeReservationResult({ allowed: true, request_id: "request-1" }),
    { allowed: true, requestId: "request-1" },
  );
  assert.deepEqual(
    recordedCreativeResult({
      id: "asset-1",
      version: 2,
      status: "selected",
      storage_path: "org/action/asset.jpg",
    }),
    {
      id: "asset-1",
      version: 2,
      status: "selected",
      storagePath: "org/action/asset.jpg",
    },
  );
  assert.equal(
    creativeAssetFromRow({
      id: "asset-1",
      action_id: "action-1",
      format: "story",
      headline: "Une story claire",
      version: 2,
      status: "selected",
      storage_path: "org/action/asset.jpg",
      model: "gpt-image-2",
      created_at: "2026-08-09T10:00:00.000Z",
    })?.version,
    2,
  );
  assert.equal(recordedCreativeResult({ id: "asset-1", version: 0 }), null);
});

test("creative assets — explique les limites sans exposer la base", () => {
  assert.equal(creativeLimitMessage("campaign_limit").status, 429);
  assert.match(creativeLimitMessage("campaign_limit").error, /5 générations/);
  assert.equal(creativeLimitMessage("campaign_unavailable").status, 409);
});

test("migration creative assets — bucket privé, quotas et privilèges fermés", () => {
  assert.match(migration, /'campaign-creatives'[\s\S]*false[\s\S]*12582912/i);
  assert.match(migration, /create table public\.creative_generation_requests/i);
  assert.match(
    migration,
    /failure_reason text,[\s\S]*storage_path text unique[\s\S]*storage_cleanup_token uuid/i,
  );
  assert.match(migration, /create table public\.creative_assets/i);
  assert.match(migration, /date_trunc\('day'[\s\S]*>= 20/i);
  assert.match(migration, /p_action_id[\s\S]*status <> 'failed'[\s\S]*>= 5/i);
  assert.match(
    migration,
    /status = 'reserved'[\s\S]*interval '10 minutes'/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.creative_generation_requests[\s\S]*authenticated/i,
  );
  assert.match(
    migration,
    /creative_assets_select[\s\S]*admin[\s\S]*marketing[\s\S]*direction[\s\S]*lecture/i,
  );
});

test("migration creative assets — conserve les métadonnées tant que Storage n'est pas nettoyé", () => {
  assert.match(
    migration,
    /creative_generation_requests[\s\S]*organization_id uuid not null[\s\S]*on delete restrict/i,
  );
  assert.match(
    migration,
    /actor_id uuid references auth\.users\(id\) on delete set null/i,
  );
  assert.match(
    migration,
    /request_id uuid not null unique[\s\S]*on delete restrict/i,
  );
  assert.ok((migration.match(/on delete restrict/gi)?.length ?? 0) >= 5);
  assert.match(
    migration,
    /request\.status = 'reserved'[\s\S]*request\.storage_path = p_storage_path/i,
  );
  assert.match(
    migration,
    /claim_creative_storage_cleanup[\s\S]*from public\.organizations[\s\S]*for update[\s\S]*not exists[\s\S]*creative_assets/i,
  );
  assert.match(
    migration,
    /finish_creative_storage_cleanup[\s\S]*storage_cleanup_token = p_cleanup_token/i,
  );
});

test("migration creative assets — version retenue et validation campagne atomiques", () => {
  const recordStart = migration.indexOf("function public.record_creative_asset");
  const selectionStart = migration.indexOf("function public.select_creative_asset");
  const decisionStart = migration.indexOf(
    "create or replace function public.transition_action_decision_v2",
  );
  assert.ok(recordStart >= 0 && selectionStart > recordStart && decisionStart > selectionStart);
  const recordBlock = migration.slice(recordStart, selectionStart);
  assert.match(recordBlock, /max\(asset\.version\)[\s\S]*status = 'draft'[\s\S]*v_status := 'selected'/i);
  assert.match(recordBlock, /insert into public\.journal[\s\S]*'creative_image_generated'/i);
  const decisionBlock = migration.slice(decisionStart);
  const organizationLock = decisionBlock.indexOf("from public.organizations");
  const actionUpdate = decisionBlock.indexOf("update public.actions");
  assert.ok(organizationLock > 0 && actionUpdate > organizationLock);
  assert.match(
    decisionBlock.slice(organizationLock, actionUpdate),
    /where id = p_organization_id[\s\S]*for update/i,
  );
  const validates = decisionBlock.indexOf("status = 'validated'");
  const journals = decisionBlock.indexOf("insert into public.journal");
  assert.ok(validates > 0 && journals > validates);
  assert.match(decisionBlock, /p_reason text[\s\S]*decision_reason/i);
  assert.match(decisionBlock, /'reason', v_action\.decision_reason/i);
  assert.match(decisionBlock, /'creative_id', v_creative_id/i);
  assert.match(
    migration,
    /v_action_status = 'approved' and exists[\s\S]*asset\.status = 'validated'[\s\S]*asset\.id <> p_creative_id/i,
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.transition_action_decision\s*\(/i,
  );
  assert.match(migration, /requires schema version 27/i);
  assert.match(migration, /greatest\(version, 28\)/i);
});
