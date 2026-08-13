import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  listMetaAdAccounts,
  metaGraphGet,
  MetaReadError,
  type JsonObject,
  type MetaAdAccount,
  type MetaReadErrorCode,
} from "./meta-ads.ts";

export const META_METRIC_WINDOWS = [7, 14, 30] as const;
export const META_ACTION_ATTRIBUTION_WINDOWS = ["7d_click", "1d_view"] as const;
export const META_MAX_CAMPAIGNS = 500;
export const META_MAX_METRIC_ROWS = 5_000;
export const META_PAGE_SIZE = 100;
export const META_MAX_PAGES = 50;

type Admin = ReturnType<typeof createAdminClient>;
type MetricWindow = (typeof META_METRIC_WINDOWS)[number];

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  configured_status: string;
  objective: string | null;
}

export interface MetaProviderResult {
  type: string;
  value: number;
  source: "provider_reported";
}

export interface MetaMetricRow {
  campaign_id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  results: MetaProviderResult[];
}

export interface MetaMetricsSnapshot {
  version: 2;
  provider: "meta_ads";
  account: MetaAdAccount;
  window_days: MetricWindow;
  observation_from: string;
  observation_to: string;
  attribution: {
    model: "requested_windows";
    windows: [...typeof META_ACTION_ATTRIBUTION_WINDOWS];
  };
  quality: "complete";
  campaigns: MetaCampaign[];
  rows: MetaMetricRow[];
  collected_at: string;
}

export interface MetaMetricsState {
  version: 1;
  quality: "complete" | "partial" | "unavailable";
  account_id: string;
  observation_from?: string;
  observation_to?: string;
  currency?: string;
  timezone?: string;
  campaign_count?: number;
  row_count?: number;
  result_count?: number;
  completed_at: string;
  error_code?: MetaReadErrorCode;
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function identifier(value: unknown, max = 64): string | null {
  const normalized = text(value, max);
  return normalized && /^\d+$/.test(normalized) ? normalized : null;
}

function safeLabel(value: unknown, max: number): string | null {
  const normalized = text(value, max);
  return normalized && !/[\u0000-\u001f\u007f]/.test(normalized) ? normalized : null;
}

function resultType(value: unknown): string | null {
  const normalized = text(value, 160);
  return normalized && /^[A-Za-z0-9_.:-]+$/.test(normalized) ? normalized : null;
}

function day(value: unknown): string | null {
  const normalized = text(value, 10);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647 ? parsed : null;
}

function nonNegativeDecimal(value: unknown, decimals: number, max: number): number | null {
  const raw = typeof value === "number" ? String(value) : value;
  const pattern = new RegExp(`^\\d{1,12}(?:\\.\\d{1,${decimals}})?$`);
  if (typeof raw !== "string" || !pattern.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed <= max ? parsed : null;
}

function isMetricWindow(value: number): value is MetricWindow {
  return (META_METRIC_WINDOWS as readonly number[]).includes(value);
}

function timezoneDate(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const value = `${values.year}-${values.month}-${values.day}`;
    if (!day(value)) throw new Error("invalid timezone date");
    return value;
  } catch {
    throw new MetaReadError("invalid_response", "Fuseau du compte Meta Ads invalide.");
  }
}

export function metaMetricWindow(days: number, timezone: string, now = new Date()): {
  days: MetricWindow;
  since: string;
  until: string;
} {
  if (!isMetricWindow(days)) {
    throw new MetaReadError("invalid_response", "Fenêtre Meta Ads invalide.");
  }
  const until = timezoneDate(now, timezone);
  const sinceDate = new Date(`${until}T00:00:00.000Z`);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - days + 1);
  return { days, since: sinceDate.toISOString().slice(0, 10), until };
}

function paginationCursor(payload: JsonObject): string | null {
  const paging = object(payload.paging);
  if (!paging?.next) return null;
  const after = text(object(paging.cursors)?.after, 512);
  if (!after) {
    throw new MetaReadError("partial_response", "Pagination Meta Ads invalide ou partielle.");
  }
  return after;
}

async function readAllPages(
  path: string,
  baseQuery: Record<string, string>,
  accessToken: string,
  maxItems: number,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  let after: string | null = null;
  for (let page = 0; page < META_MAX_PAGES; page += 1) {
    const payload = await metaGraphGet(path, {
      ...baseQuery,
      limit: String(META_PAGE_SIZE),
      access_token: accessToken,
      ...(after ? { after } : {}),
    });
    if (!Array.isArray(payload.data)) {
      throw new MetaReadError("invalid_response", "Réponse Meta Ads invalide.");
    }
    if (rows.length + payload.data.length > maxItems) {
      throw new MetaReadError("snapshot_too_large", "Photographie Meta Ads au-delà de la borne.");
    }
    rows.push(...payload.data);
    after = paginationCursor(payload);
    if (!after) return rows;
  }
  throw new MetaReadError("snapshot_too_large", "Pagination Meta Ads au-delà de la borne.");
}

function parseCampaign(value: unknown): MetaCampaign {
  const item = object(value);
  const id = identifier(item?.id, 32);
  const name = safeLabel(item?.name, 200);
  const status = text(item?.effective_status, 40);
  const configuredStatus = text(item?.status, 40);
  const rawObjective = item?.objective;
  const objective = rawObjective === undefined || rawObjective === null
    ? null
    : text(rawObjective, 80);
  if (!id || !name || !status || !configuredStatus || (rawObjective != null && !objective)) {
    throw new MetaReadError("partial_response", "Campagne Meta Ads invalide ou partielle.");
  }
  return { id, name, status, configured_status: configuredStatus, objective };
}

function parseResults(value: unknown): MetaProviderResult[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new MetaReadError("partial_response", "Résultats Meta Ads invalides ou partiels.");
  }
  const seen = new Set<string>();
  return value.map((entry) => {
    const item = object(entry);
    const type = resultType(item?.action_type);
    const resultValue = nonNegativeDecimal(item?.value, 6, 999_999_999_999);
    if (!type || resultValue === null || seen.has(type)) {
      throw new MetaReadError("partial_response", "Résultats Meta Ads invalides ou ambigus.");
    }
    seen.add(type);
    return { type, value: resultValue, source: "provider_reported" as const };
  }).sort((left, right) => left.type.localeCompare(right.type));
}

function parseMetricRow(
  value: unknown,
  campaigns: ReadonlyMap<string, MetaCampaign>,
  account: MetaAdAccount,
  since: string,
  until: string,
): MetaMetricRow {
  const item = object(value);
  const campaignId = identifier(item?.campaign_id, 32);
  const campaign = campaignId ? campaigns.get(campaignId) : undefined;
  const campaignName = safeLabel(item?.campaign_name, 200);
  const metricDate = day(item?.date_start);
  const impressions = nonNegativeInteger(item?.impressions);
  const clicks = nonNegativeInteger(item?.clicks);
  const spend = nonNegativeDecimal(item?.spend, 2, 9_999_999_999.99);
  const currency = text(item?.account_currency, 3)?.toUpperCase();
  if (
    !campaign || !campaignName || campaign.name !== campaignName || !metricDate ||
    metricDate < since || metricDate > until || impressions === null || clicks === null ||
    spend === null
  ) {
    throw new MetaReadError("partial_response", "Métriques Meta Ads invalides ou partielles.");
  }
  if (currency !== account.currency) {
    throw new MetaReadError("currency_mismatch", "Devise Meta Ads incohérente.");
  }
  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    date: metricDate,
    impressions,
    clicks,
    spend,
    results: parseResults(item?.actions),
  };
}

async function verifiedAccount(
  accessToken: string,
  selected: MetaAdAccount,
): Promise<MetaAdAccount> {
  const account = (await listMetaAdAccounts(accessToken)).find((candidate) => candidate.id === selected.id);
  if (
    !account || account.currency !== selected.currency || account.timezone !== selected.timezone
  ) {
    throw new MetaReadError("account_changed", "Le compte Meta Ads sélectionné a changé.");
  }
  return account;
}

export async function readMetaMetricsSnapshot(
  accessToken: string,
  selected: MetaAdAccount,
  days: number,
  now = new Date(),
): Promise<MetaMetricsSnapshot> {
  const account = await verifiedAccount(accessToken, selected);
  const window = metaMetricWindow(days, account.timezone, now);
  const campaignPayloads = await readAllPages(
    `${account.id}/campaigns`,
    { fields: "id,name,status,effective_status,objective" },
    accessToken,
    META_MAX_CAMPAIGNS,
  );
  const campaigns = campaignPayloads.map(parseCampaign).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(campaigns.map((campaign) => campaign.id)).size !== campaigns.length) {
    throw new MetaReadError("partial_response", "Campagnes Meta Ads ambiguës.");
  }
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const metricPayloads = await readAllPages(
    `${account.id}/insights`,
    {
      level: "campaign",
      fields: "campaign_id,campaign_name,date_start,impressions,clicks,spend,account_currency,actions",
      time_increment: "1",
      time_range: JSON.stringify({ since: window.since, until: window.until }),
      action_attribution_windows: JSON.stringify(META_ACTION_ATTRIBUTION_WINDOWS),
    },
    accessToken,
    META_MAX_METRIC_ROWS,
  );
  const rows = metricPayloads
    .map((entry) => parseMetricRow(entry, campaignMap, account, window.since, window.until))
    .sort((left, right) => left.campaign_id.localeCompare(right.campaign_id) || left.date.localeCompare(right.date));
  if (new Set(rows.map((row) => `${row.campaign_id}:${row.date}`)).size !== rows.length) {
    throw new MetaReadError("partial_response", "Métriques Meta Ads ambiguës.");
  }
  return {
    version: 2,
    provider: "meta_ads",
    account,
    window_days: window.days,
    observation_from: window.since,
    observation_to: window.until,
    attribution: {
      model: "requested_windows",
      windows: [...META_ACTION_ATTRIBUTION_WINDOWS],
    },
    quality: "complete",
    campaigns,
    rows,
    collected_at: now.toISOString(),
  };
}

function snapshotHash(snapshot: MetaMetricsSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

async function reconcileAppliedSnapshot(
  admin: Admin,
  organizationId: string,
  idempotencyKey: string,
): Promise<{ replayed: true; metrics: number; results: number } | null> {
  const { data, error } = await admin
    .from("ad_metric_sync_runs")
    .select("quality, applied, metric_count, result_count")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) {
    throw new MetaReadError(
      "persistence_ambiguous",
      "État de la photographie Meta Ads impossible à confirmer.",
    );
  }
  return data?.quality === "complete" && data.applied === true
    ? {
        replayed: true,
        metrics: typeof data.metric_count === "number" ? data.metric_count : 0,
        results: typeof data.result_count === "number" ? data.result_count : 0,
      }
    : null;
}

export async function applyMetaMetricsSnapshot(
  admin: Admin,
  input: {
    organizationId: string;
    connectorId: string;
    actorId: string;
    startedAt: string;
    snapshot: MetaMetricsSnapshot;
  },
): Promise<{ replayed: boolean; metrics: number; results: number }> {
  const idempotencyKey = `meta-metrics:${input.connectorId}:${snapshotHash(input.snapshot)}`;
  let response: Awaited<ReturnType<Admin["rpc"]>>;
  try {
    response = await admin.rpc("apply_meta_metrics_snapshot", {
      p_organization_id: input.organizationId,
      p_connector_id: input.connectorId,
      p_actor_id: input.actorId,
      p_idempotency_key: idempotencyKey,
      p_started_at: input.startedAt,
      p_snapshot: input.snapshot,
    });
  } catch {
    const reconciled = await reconcileAppliedSnapshot(admin, input.organizationId, idempotencyKey);
    if (reconciled) return reconciled;
    throw new MetaReadError("persistence_failed", "Application de la photographie Meta Ads impossible.");
  }
  const { data, error } = response;
  if (error) {
    if (!("code" in error) || !error.code) {
      const reconciled = await reconcileAppliedSnapshot(admin, input.organizationId, idempotencyKey);
      if (reconciled) return reconciled;
    }
    const code = /stale snapshot/i.test(error.message) ? "stale_snapshot" : "persistence_failed";
    throw new MetaReadError(code, "Application de la photographie Meta Ads impossible.");
  }
  const value = object(data);
  return {
    replayed: value?.replayed === true,
    metrics: typeof value?.metrics === "number" ? value.metrics : input.snapshot.rows.length,
    results: typeof value?.results === "number"
      ? value.results
      : input.snapshot.rows.reduce((sum, row) => sum + row.results.length, 0),
  };
}

export function failureQuality(code: MetaReadErrorCode): "partial" | "unavailable" {
  return code === "partial_response" || code === "snapshot_too_large"
    ? "partial"
    : "unavailable";
}

export function metaReadError(error: unknown): MetaReadError {
  return error instanceof MetaReadError
    ? error
    : new MetaReadError("invalid_response", "Lecture Meta Ads impossible.");
}

export async function recordMetaMetricsFailure(
  admin: Admin,
  input: {
    organizationId: string;
    connectorId: string;
    actorId: string;
    accountId: string;
    startedAt: string;
    error: MetaReadError;
  },
): Promise<void> {
  const keyMaterial = `${input.connectorId}:${input.startedAt}:${input.error.code}`;
  const idempotencyKey = `meta-metrics-failure:${createHash("sha256").update(keyMaterial).digest("hex")}`;
  const { error } = await admin.rpc("record_meta_metrics_failure", {
    p_organization_id: input.organizationId,
    p_connector_id: input.connectorId,
    p_actor_id: input.actorId,
    p_account_id: input.accountId,
    p_idempotency_key: idempotencyKey,
    p_started_at: input.startedAt,
    p_quality: failureQuality(input.error.code),
    p_error_code: input.error.code,
  });
  if (error) {
    throw new MetaReadError("persistence_failed", "Journalisation de la lecture Meta Ads impossible.");
  }
}

export function readMetaMetricsState(config: unknown): MetaMetricsState | null {
  const state = object(object(config)?.meta_metrics_state);
  if (!state || state.version !== 1) return null;
  const quality = state.quality;
  const accountId = text(state.account_id, 40);
  const completedAt = text(state.completed_at, 40);
  if (
    (quality !== "complete" && quality !== "partial" && quality !== "unavailable") ||
    !accountId || !/^act_\d{1,32}$/.test(accountId) || !completedAt ||
    Number.isNaN(Date.parse(completedAt))
  ) return null;
  if (quality !== "complete") {
    const errorCode = text(state.error_code, 40) as MetaReadErrorCode | null;
    const allowed: readonly MetaReadErrorCode[] = [
      "timeout", "provider_error", "invalid_response", "partial_response",
      "snapshot_too_large", "account_changed", "currency_mismatch",
      "persistence_failed", "persistence_ambiguous", "stale_snapshot",
    ];
    return errorCode && allowed.includes(errorCode)
      ? { version: 1, quality, account_id: accountId, completed_at: completedAt, error_code: errorCode }
      : null;
  }
  const observationFrom = day(state.observation_from);
  const observationTo = day(state.observation_to);
  const currency = text(state.currency, 3)?.toUpperCase();
  const timezone = safeLabel(state.timezone, 80);
  const campaignCount = nonNegativeInteger(state.campaign_count);
  const rowCount = nonNegativeInteger(state.row_count);
  const resultCount = nonNegativeInteger(state.result_count);
  if (
    !observationFrom || !observationTo || observationFrom > observationTo ||
    !currency || !/^[A-Z]{3}$/.test(currency) || !timezone ||
    campaignCount === null || rowCount === null || resultCount === null ||
    campaignCount > META_MAX_CAMPAIGNS || rowCount > META_MAX_METRIC_ROWS ||
    resultCount > META_MAX_METRIC_ROWS * 100
  ) return null;
  return {
    version: 1,
    quality,
    account_id: accountId,
    observation_from: observationFrom,
    observation_to: observationTo,
    currency,
    timezone,
    campaign_count: campaignCount,
    row_count: rowCount,
    result_count: resultCount,
    completed_at: completedAt,
  };
}
