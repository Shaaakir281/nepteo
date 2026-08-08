/**
 * CAMP-2 — contrat pur du cockpit Campagnes.
 *
 * Aucun I/O et aucune hypothèse de statut fournisseur : `ad_metrics` prouve
 * une performance observée, pas qu'une campagne est active ou terminée.
 */

export const CAMPAIGN_COCKPIT_CHANNELS = [
  "meta",
  "google",
  "linkedin",
  "email",
] as const;

export const CAMPAIGN_COCKPIT_STATUSES = [
  "active",
  "ended",
  "waiting",
  "blocked",
  "recent_data",
  "historical_data",
] as const;

export type CampaignCockpitChannel = (typeof CAMPAIGN_COCKPIT_CHANNELS)[number];
export type CampaignCockpitStatus = (typeof CAMPAIGN_COCKPIT_STATUSES)[number];

type SupportedProvider =
  | "meta_ads"
  | "google_ads"
  | "linkedin_ads"
  | "email"
  | "outbound_email";

const PROVIDER_CHANNEL: Record<SupportedProvider, CampaignCockpitChannel> = {
  meta_ads: "meta",
  google_ads: "google",
  linkedin_ads: "linkedin",
  email: "email",
  outbound_email: "email",
};

const CHANNEL_PROVIDER: Record<CampaignCockpitChannel, SupportedProvider> = {
  meta: "meta_ads",
  google: "google_ads",
  linkedin: "linkedin_ads",
  email: "email",
};

const ACTION_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "postponed",
  "executed",
  "failed",
] as const;

type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface CampaignCockpitRange {
  from: string;
  to: string;
}

export type CampaignCockpitComparisonInput =
  | { kind: "none" }
  | ({ kind: "period" } & CampaignCockpitRange);

export interface CampaignCockpitFiltersInput {
  channels: "all" | readonly CampaignCockpitChannel[];
  statuses: "all" | readonly CampaignCockpitStatus[];
}

export interface BuildCampaignCockpitInput {
  rows: unknown;
  actions: unknown;
  journal: unknown;
  /** Snapshots de cycle de vie relus du fournisseur, jamais déduits des KPI. */
  providerStatuses?: unknown;
  window: unknown;
  comparison: unknown;
  filters: unknown;
}

export interface ObservedCampaignMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  cac: number | null;
  roas: number | null;
  /** Coût observé pour 1 000 impressions, jamais remplacé par zéro sans impression. */
  cpm: ObservedDeliveryMetric;
  /** Clics observés / impressions observées, exprimé sous forme de ratio. */
  ctr: ObservedDeliveryMetric;
}

export type ObservedDeliveryMetric =
  | { status: "available"; value: number }
  | { status: "unavailable"; value: null; reason: "zero_impressions" };

export type ObservedDeliveryChange =
  | { status: "available"; value: number }
  | {
      status: "unavailable";
      value: null;
      reason: "current_metric_unavailable" | "previous_metric_unavailable" | "zero_previous_value";
    };

export interface ObservedMetricsSource {
  kind: "ad_metrics";
  provider: SupportedProvider | "multiple";
  rowCount: number;
  from: string;
  to: string;
  lastSyncedAt: string | null;
}

export interface ObservedPerformance {
  kind: "observed";
  scope: "selected_window" | "observed_history";
  metrics: ObservedCampaignMetrics;
  source: ObservedMetricsSource;
}

export type CampaignStatusEvidence =
  | {
      value: "active" | "ended";
      basis: "provider_status";
      source: {
        kind: "provider_status";
        provider: SupportedProvider;
        observedAt: string;
      };
    }
  | {
      value: "waiting";
      basis: "action";
      source: { kind: "action"; actionId: string; status: ActionStatus; at: string };
    }
  | {
      value: "waiting" | "blocked";
      basis: "journal";
      source: {
        kind: "journal";
        journalId: string;
        event: "campaign_waiting" | "campaign_blocked";
        at: string;
        reason: string;
      };
    }
  | {
      value: "recent_data" | "historical_data";
      basis: "metric_recency";
      source: ObservedMetricsSource;
    };

export interface CampaignPeriodComparison {
  status: "available";
  period: CampaignCockpitRange;
  current: ObservedCampaignMetrics;
  previous: ObservedCampaignMetrics;
  changes: {
    spend: number | null;
    conversions: number | null;
    revenue: number | null;
    cac: number | null;
    roas: number | null;
    cpm: ObservedDeliveryChange;
    ctr: ObservedDeliveryChange;
  };
  source: {
    kind: "ad_metrics";
    currentPeriod: CampaignCockpitRange;
    previousPeriod: CampaignCockpitRange;
    currentRowCount: number;
    previousRowCount: number;
  };
}

export type CampaignComparisonResult =
  | CampaignPeriodComparison
  | { status: "unavailable"; reason: "disabled" | "no_current_rows" | "no_previous_rows" };

export type CampaignDeliveryDirection = "higher" | "lower" | "unchanged";

export interface CampaignDeliveryDiagnosticSource {
  kind: "ad_metrics";
  currentPeriod: CampaignCockpitRange;
  previousPeriod: CampaignCockpitRange | null;
  currentRowCount: number;
  previousRowCount: number;
}

export type CampaignDeliveryDiagnostic =
  | {
      kind: "observed_delivery_comparison";
      status: "available";
      pattern: "higher_ctr_lower_cpm" | "lower_ctr_higher_cpm" | "mixed_or_unchanged";
      directions: { cpm: CampaignDeliveryDirection; ctr: CampaignDeliveryDirection };
      current: { cpm: number; ctr: number };
      previous: { cpm: number; ctr: number };
      source: CampaignDeliveryDiagnosticSource;
      interpretation: "descriptive_only_no_causality";
      confidence: { value: null; basis: "not_calibrated" };
    }
  | {
      kind: "observed_delivery_comparison";
      status: "unavailable";
      reason:
        | "comparison_disabled"
        | "no_current_rows"
        | "no_previous_rows"
        | "current_zero_impressions"
        | "previous_zero_impressions";
      source: CampaignDeliveryDiagnosticSource;
      interpretation: "descriptive_only_no_causality";
      confidence: { value: null; basis: "not_calibrated" };
    };

export interface CampaignAgentReading {
  kind: "observed_performance";
  verdict:
    | "revenue_below_spend"
    | "revenue_at_or_above_spend"
    | "spend_without_conversion"
    | "no_positive_spend";
  facts: ObservedCampaignMetrics;
  source: ObservedMetricsSource;
  confidence: { value: null; basis: "not_calibrated" };
}

export interface CampaignAttempt {
  actionId: string;
  campaignKey: string | null;
  channel: CampaignCockpitChannel | null;
  kind: string;
  title: string;
  status: ActionStatus;
  createdAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  recordedConfidence: {
    value: number;
    source: "action_record";
  } | null;
  dataSources: string[];
  journalEvents: Array<{ id: string; event: string; at: string }>;
}

export interface CampaignCockpitItem {
  key: string;
  campaignId: string;
  campaignName: string;
  provider: SupportedProvider;
  channel: CampaignCockpitChannel;
  /** Identifiant Nepteo d'une proposition, pas un identifiant fournisseur. */
  internal: boolean;
  status: CampaignStatusEvidence;
  performance: ObservedPerformance | null;
  comparison: CampaignComparisonResult;
  deliveryDiagnostic: CampaignDeliveryDiagnostic;
  reading: CampaignAgentReading | null;
  attempts: CampaignAttempt[];
}

export interface CampaignCockpitRecommendation {
  priority: 1;
  kind: "resolve_observed_blocker" | "review_observed_underperformance";
  campaignKey: string;
  campaignId: string;
  campaignName: string;
  reason: "journal_blocker" | "revenue_below_spend" | "spend_without_observed_conversion";
  evidence:
    | { kind: "journal"; journalId: string; event: string; at: string; reason: string }
    | ({ kind: "ad_metrics" } & ObservedCampaignMetrics & { period: CampaignCockpitRange; rowCount: number });
  confidence: { value: null; basis: "not_calibrated" };
}

export interface CampaignCockpit {
  window: CampaignCockpitRange;
  comparisonPeriod: CampaignCockpitComparisonInput;
  filters: CampaignCockpitFiltersInput;
  totals:
    | {
        status: "available";
        metrics: ObservedCampaignMetrics;
        source: ObservedMetricsSource;
      }
    | { status: "unavailable"; reason: "no_rows_in_window"; metrics: null };
  comparison: CampaignComparisonResult;
  deliveryDiagnostic: CampaignDeliveryDiagnostic;
  campaigns: CampaignCockpitItem[];
  recommendation: CampaignCockpitRecommendation | null;
  history: {
    attempts: CampaignAttempt[];
    unlinkedJournalEvents: Array<{ id: string; event: string; at: string }>;
  };
  provenance: {
    metricRows: number;
    actionRows: number;
    journalRows: number;
    providerStatusRows: number;
    futureMetricRowsExcluded: number;
  };
}

export type CampaignCockpitError =
  | "invalid_window"
  | "invalid_comparison"
  | "invalid_filters"
  | "rows_unavailable"
  | "invalid_metric_row"
  | "duplicate_metric_row"
  | "actions_unavailable"
  | "invalid_action_row"
  | "journal_unavailable"
  | "invalid_journal_row"
  | "provider_statuses_unavailable"
  | "invalid_provider_status_row"
  | "conflicting_provider_status";

export type BuildCampaignCockpitResult =
  | { ok: true; cockpit: CampaignCockpit }
  | { ok: false; error: CampaignCockpitError; invalidIndex?: number };

interface NormalizedMetric {
  provider: SupportedProvider;
  channel: CampaignCockpitChannel;
  campaignId: string;
  campaignName: string;
  date: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents: number;
  syncedAt: string;
}

interface CampaignRef {
  provider: SupportedProvider | null;
  campaignId: string;
  campaignName: string | null;
  internal: boolean;
}

interface NormalizedAction {
  id: string;
  kind: string;
  title: string;
  status: ActionStatus;
  createdAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  confidence: number | null;
  dataSources: string[];
  ref: CampaignRef | null;
}

interface NormalizedJournal {
  id: string;
  actionId: string | null;
  event: string;
  createdAt: string;
  ref: CampaignRef | null;
  reason: string | null;
}

interface NormalizedProviderStatus {
  provider: SupportedProvider;
  campaignId: string;
  status: "active" | "ended";
  observedAt: string;
}

interface CampaignGroup {
  key: string;
  provider: SupportedProvider;
  channel: CampaignCockpitChannel;
  campaignId: string;
  campaignName: string;
  internal: boolean;
  rows: NormalizedMetric[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Bornes des colonnes PostgreSQL `integer` et `numeric(12,2)` de `ad_metrics`.
const MAX_DB_INTEGER = 2_147_483_647;
const MAX_DB_AMOUNT_CENTS = 999_999_999_999;
const MAX_STATUS_REASON_LENGTH = 500;

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function provider(value: unknown): SupportedProvider | null {
  const text = nonEmptyText(value)?.toLowerCase();
  return text && text in PROVIDER_CHANNEL ? (text as SupportedProvider) : null;
}

function cents(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value.trim())
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_DB_AMOUNT_CENTS / 100) {
    return null;
  }
  const asCents = Math.round(parsed * 100);
  return Math.abs(asCents / 100 - parsed) < 1e-9 ? asCents : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_DB_INTEGER ? parsed : null;
}

function normalizeRange(value: unknown): CampaignCockpitRange | null {
  if (!isRecord(value)) return null;
  const from = isoDate(value.from);
  const to = isoDate(value.to);
  return from && to && from <= to ? { from, to } : null;
}

function normalizeComparison(value: unknown, window: CampaignCockpitRange): CampaignCockpitComparisonInput | null {
  if (!isRecord(value) || (value.kind !== "none" && value.kind !== "period")) return null;
  if (value.kind === "none") return { kind: "none" };
  const period = normalizeRange(value);
  return period && period.to < window.from ? { kind: "period", ...period } : null;
}

function uniqueSelection<T extends string>(
  value: unknown,
  allowed: readonly T[],
): "all" | T[] | null {
  if (value === "all") return "all";
  if (!Array.isArray(value)) return null;
  const out = new Set<T>();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item as T)) return null;
    out.add(item as T);
  }
  return [...out].sort();
}

function normalizeFilters(value: unknown): CampaignCockpitFiltersInput | null {
  if (!isRecord(value)) return null;
  const channels = uniqueSelection(value.channels, CAMPAIGN_COCKPIT_CHANNELS);
  const statuses = uniqueSelection(value.statuses, CAMPAIGN_COCKPIT_STATUSES);
  return channels && statuses ? { channels, statuses } : null;
}

function normalizeMetric(value: unknown): NormalizedMetric | null {
  if (!isRecord(value)) return null;
  const normalizedProvider = provider(value.provider);
  const campaignId = nonEmptyText(value.campaign_id);
  const campaignName = nonEmptyText(value.campaign_name);
  const date = isoDate(value.date);
  const impressions = nonNegativeInteger(value.impressions);
  const clicks = nonNegativeInteger(value.clicks);
  const spendCents = cents(value.spend);
  const conversions = nonNegativeInteger(value.conversions);
  const revenueCents = cents(value.revenue);
  const syncedAt = isoTimestamp(value.synced_at);
  if (
    !normalizedProvider || !campaignId || !campaignName || !date || impressions === null ||
    clicks === null || spendCents === null || conversions === null ||
    revenueCents === null || !syncedAt
  ) return null;
  return {
    provider: normalizedProvider,
    channel: PROVIDER_CHANNEL[normalizedProvider],
    campaignId,
    campaignName,
    date,
    impressions,
    clicks,
    spendCents,
    conversions,
    revenueCents,
    syncedAt,
  };
}

function payloadRef(payload: unknown): CampaignRef | null {
  if (!isRecord(payload)) return null;
  const campaignId = nonEmptyText(payload.campaign_id);
  if (!campaignId) return null;
  return {
    provider: provider(payload.provider),
    campaignId,
    campaignName: nonEmptyText(payload.campaign_name),
    internal: false,
  };
}

function internalLaunchRef(
  actionId: string,
  actionTitle: string,
  kind: string,
  payload: Record<string, unknown>,
): CampaignRef | null {
  if (kind !== "launch_campaign" || !isRecord(payload.brief)) return null;
  const channel = nonEmptyText(payload.brief.channel);
  if (!channel || !CAMPAIGN_COCKPIT_CHANNELS.includes(channel as CampaignCockpitChannel)) {
    return null;
  }
  return {
    provider: CHANNEL_PROVIDER[channel as CampaignCockpitChannel],
    campaignId: actionId,
    campaignName: actionTitle,
    internal: true,
  };
}

function internalKey(ref: CampaignRef): string {
  const channel = ref.provider ? PROVIDER_CHANNEL[ref.provider] : "unknown";
  return `internal-action:${channel}:${ref.campaignId}`;
}

function normalizeAction(value: unknown): NormalizedAction | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyText(value.id);
  const kind = nonEmptyText(value.kind);
  const title = nonEmptyText(value.title);
  const createdAt = isoTimestamp(value.created_at);
  const decidedAt = value.decided_at == null ? null : isoTimestamp(value.decided_at);
  const decisionReason = value.decision_reason == null
    ? null
    : nonEmptyText(value.decision_reason);
  const status = ACTION_STATUSES.includes(value.status as ActionStatus)
    ? (value.status as ActionStatus)
    : null;
  const confidence = value.confidence == null
    ? null
    : typeof value.confidence === "number" && Number.isFinite(value.confidence) &&
        value.confidence >= 0 && value.confidence <= 1
      ? value.confidence
      : null;
  const dataSources = Array.isArray(value.data_sources) && value.data_sources.every(nonEmptyText)
    ? value.data_sources.map((item) => String(item).trim())
    : null;
  if (!id || !kind || !title || !createdAt || !status || decidedAt === null && value.decided_at != null ||
      confidence === null && value.confidence != null ||
      decisionReason === null && value.decision_reason != null ||
      decisionReason !== null && (decisionReason.length < 3 || decisionReason.length > 500) ||
      !dataSources || !isRecord(value.payload)) {
    return null;
  }
  const ref = payloadRef(value.payload) ?? internalLaunchRef(id, title, kind, value.payload);
  return {
    id,
    kind,
    title,
    status,
    createdAt,
    decidedAt,
    decisionReason,
    confidence,
    dataSources,
    ref,
  };
}

function normalizeJournal(value: unknown): NormalizedJournal | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyText(value.id);
  const event = nonEmptyText(value.event);
  const createdAt = isoTimestamp(value.created_at);
  const actionId = value.action_id == null ? null : nonEmptyText(value.action_id);
  if (!id || !event || !createdAt || actionId === null && value.action_id != null || !isRecord(value.payload)) {
    return null;
  }
  const reason = nonEmptyText(value.payload.reason);
  if (
    ["campaign_waiting", "campaign_blocked"].includes(event) &&
    (!reason || reason.length > MAX_STATUS_REASON_LENGTH)
  ) {
    return null;
  }
  return {
    id,
    actionId,
    event,
    createdAt,
    ref: payloadRef(value.payload),
    reason,
  };
}

function normalizeProviderStatus(value: unknown): NormalizedProviderStatus | null {
  if (!isRecord(value)) return null;
  const normalizedProvider = provider(value.provider);
  const campaignId = nonEmptyText(value.campaign_id);
  const observedAt = isoTimestamp(value.observed_at);
  const status = value.status === "active" || value.status === "ended" ? value.status : null;
  return normalizedProvider && campaignId && observedAt && status
    ? { provider: normalizedProvider, campaignId, observedAt, status }
    : null;
}

function keyFor(providerName: SupportedProvider, campaignId: string): string {
  return `${providerName}:${campaignId}`;
}

function metricsFor(rows: readonly NormalizedMetric[]): ObservedCampaignMetrics {
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const spendCents = rows.reduce((sum, row) => sum + row.spendCents, 0);
  const revenueCents = rows.reduce((sum, row) => sum + row.revenueCents, 0);
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);
  const spend = spendCents / 100;
  const revenue = revenueCents / 100;
  const cpm: ObservedDeliveryMetric = impressions > 0
    ? { status: "available", value: Math.round((spend / impressions) * 100_000) / 100 }
    : { status: "unavailable", value: null, reason: "zero_impressions" };
  const ctr: ObservedDeliveryMetric = impressions > 0
    ? { status: "available", value: Math.round((clicks / impressions) * 1_000_000) / 1_000_000 }
    : { status: "unavailable", value: null, reason: "zero_impressions" };
  return {
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
    cac: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : null,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
    cpm,
    ctr,
  };
}

function sourceFor(rows: readonly NormalizedMetric[], from: string, to: string): ObservedMetricsSource {
  const providers = new Set(rows.map((row) => row.provider));
  return {
    kind: "ad_metrics",
    provider: providers.size === 1 ? [...providers][0] : "multiple",
    rowCount: rows.length,
    from,
    to,
    lastSyncedAt: rows.map((row) => row.syncedAt).sort().at(-1) ?? null,
  };
}

function relativeChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 10_000;
}

function deliveryChange(
  current: ObservedDeliveryMetric,
  previous: ObservedDeliveryMetric,
): ObservedDeliveryChange {
  if (current.status === "unavailable") {
    return { status: "unavailable", value: null, reason: "current_metric_unavailable" };
  }
  if (previous.status === "unavailable") {
    return { status: "unavailable", value: null, reason: "previous_metric_unavailable" };
  }
  if (previous.value === 0) {
    return { status: "unavailable", value: null, reason: "zero_previous_value" };
  }
  return {
    status: "available",
    value: Math.round(((current.value - previous.value) / previous.value) * 10_000) / 10_000,
  };
}

function comparisonFor(
  currentRows: readonly NormalizedMetric[],
  previousRows: readonly NormalizedMetric[],
  comparison: CampaignCockpitComparisonInput,
  currentPeriod: CampaignCockpitRange,
): CampaignComparisonResult {
  if (comparison.kind === "none") return { status: "unavailable", reason: "disabled" };
  if (currentRows.length === 0) return { status: "unavailable", reason: "no_current_rows" };
  if (previousRows.length === 0) return { status: "unavailable", reason: "no_previous_rows" };
  const current = metricsFor(currentRows);
  const previous = metricsFor(previousRows);
  return {
    status: "available",
    period: { from: comparison.from, to: comparison.to },
    current,
    previous,
    changes: {
      spend: relativeChange(current.spend, previous.spend),
      conversions: relativeChange(current.conversions, previous.conversions),
      revenue: relativeChange(current.revenue, previous.revenue),
      cac: relativeChange(current.cac, previous.cac),
      roas: relativeChange(current.roas, previous.roas),
      cpm: deliveryChange(current.cpm, previous.cpm),
      ctr: deliveryChange(current.ctr, previous.ctr),
    },
    source: {
      kind: "ad_metrics",
      currentPeriod,
      previousPeriod: { from: comparison.from, to: comparison.to },
      currentRowCount: currentRows.length,
      previousRowCount: previousRows.length,
    },
  };
}

function deliveryDirection(current: number, previous: number): CampaignDeliveryDirection {
  if (current === previous) return "unchanged";
  return current > previous ? "higher" : "lower";
}

function deliveryDiagnosticFor(
  currentRows: readonly NormalizedMetric[],
  previousRows: readonly NormalizedMetric[],
  comparison: CampaignCockpitComparisonInput,
  currentPeriod: CampaignCockpitRange,
): CampaignDeliveryDiagnostic {
  const source: CampaignDeliveryDiagnosticSource = {
    kind: "ad_metrics",
    currentPeriod,
    previousPeriod: comparison.kind === "period"
      ? { from: comparison.from, to: comparison.to }
      : null,
    currentRowCount: currentRows.length,
    previousRowCount: previousRows.length,
  };
  const unavailable = (
    reason: Extract<CampaignDeliveryDiagnostic, { status: "unavailable" }>["reason"],
  ): CampaignDeliveryDiagnostic => ({
    kind: "observed_delivery_comparison",
    status: "unavailable",
    reason,
    source,
    interpretation: "descriptive_only_no_causality",
    confidence: { value: null, basis: "not_calibrated" },
  });

  if (comparison.kind === "none") return unavailable("comparison_disabled");
  if (currentRows.length === 0) return unavailable("no_current_rows");
  if (previousRows.length === 0) return unavailable("no_previous_rows");
  const current = metricsFor(currentRows);
  const previous = metricsFor(previousRows);
  if (current.cpm.status === "unavailable" || current.ctr.status === "unavailable") {
    return unavailable("current_zero_impressions");
  }
  if (previous.cpm.status === "unavailable" || previous.ctr.status === "unavailable") {
    return unavailable("previous_zero_impressions");
  }

  const directions = {
    cpm: deliveryDirection(current.cpm.value, previous.cpm.value),
    ctr: deliveryDirection(current.ctr.value, previous.ctr.value),
  };
  const pattern = directions.ctr === "higher" && directions.cpm === "lower"
    ? "higher_ctr_lower_cpm" as const
    : directions.ctr === "lower" && directions.cpm === "higher"
      ? "lower_ctr_higher_cpm" as const
      : "mixed_or_unchanged" as const;
  return {
    kind: "observed_delivery_comparison",
    status: "available",
    pattern,
    directions,
    current: { cpm: current.cpm.value, ctr: current.ctr.value },
    previous: { cpm: previous.cpm.value, ctr: previous.ctr.value },
    source,
    interpretation: "descriptive_only_no_causality",
    confidence: { value: null, basis: "not_calibrated" },
  };
}

function resolveRefKey(ref: CampaignRef | null, groups: ReadonlyMap<string, CampaignGroup>): string | null {
  if (!ref) return null;
  if (ref.internal) {
    const key = internalKey(ref);
    return groups.has(key) ? key : null;
  }
  if (ref.provider) {
    const key = keyFor(ref.provider, ref.campaignId);
    return groups.has(key) ? key : null;
  }
  const matches = [...groups.values()].filter((group) => group.campaignId === ref.campaignId);
  return matches.length === 1 ? matches[0].key : null;
}

function buildAttempts(
  actions: readonly NormalizedAction[],
  journal: readonly NormalizedJournal[],
  groups: ReadonlyMap<string, CampaignGroup>,
): CampaignAttempt[] {
  const eventsByAction = new Map<string, NormalizedJournal[]>();
  for (const entry of journal) {
    if (!entry.actionId) continue;
    const events = eventsByAction.get(entry.actionId) ?? [];
    events.push(entry);
    eventsByAction.set(entry.actionId, events);
  }
  return actions
    .filter((action) =>
      action.kind === "launch_campaign" || action.kind.startsWith("ads_") || action.ref !== null)
    .map((action) => ({
      actionId: action.id,
      campaignKey: resolveRefKey(action.ref, groups),
      channel: action.ref?.provider ? PROVIDER_CHANNEL[action.ref.provider] : null,
      kind: action.kind,
      title: action.title,
      status: action.status,
      createdAt: action.createdAt,
      decidedAt: action.decidedAt,
      decisionReason: action.decisionReason,
      recordedConfidence: action.confidence === null || action.kind.startsWith("ads_pause_")
        ? null
        : { value: action.confidence, source: "action_record" as const },
      dataSources: [...action.dataSources],
      journalEvents: (eventsByAction.get(action.id) ?? [])
        .map((entry) => ({ id: entry.id, event: entry.event, at: entry.createdAt }))
        .sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.actionId.localeCompare(right.actionId));
}

function statusFor(
  group: CampaignGroup,
  rowsInWindow: readonly NormalizedMetric[],
  providerStatuses: readonly NormalizedProviderStatus[],
  actions: readonly NormalizedAction[],
  journal: readonly NormalizedJournal[],
  window: CampaignCockpitRange,
  groups: ReadonlyMap<string, CampaignGroup>,
): CampaignStatusEvidence | null {
  const journalSignals = journal
    .filter((entry) => resolveRefKey(entry.ref, groups) === group.key)
    .filter((entry) => ["campaign_waiting", "campaign_blocked", "campaign_status_cleared"].includes(entry.event))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  const latestSignal = journalSignals[0];
  if (latestSignal && latestSignal.event !== "campaign_status_cleared" && latestSignal.reason) {
    return {
      value: latestSignal.event === "campaign_blocked" ? "blocked" : "waiting",
      basis: "journal",
      source: {
        kind: "journal",
        journalId: latestSignal.id,
        event: latestSignal.event as "campaign_waiting" | "campaign_blocked",
        at: latestSignal.createdAt,
        reason: latestSignal.reason,
      },
    };
  }

  const providerStatus = group.internal
    ? undefined
    : providerStatuses
        .filter((item) => item.provider === group.provider && item.campaignId === group.campaignId)
        .sort((left, right) =>
          right.observedAt.localeCompare(left.observedAt) || left.status.localeCompare(right.status))[0];
  if (providerStatus) {
    return {
      value: providerStatus.status,
      basis: "provider_status",
      source: {
        kind: "provider_status",
        provider: providerStatus.provider,
        observedAt: providerStatus.observedAt,
      },
    };
  }

  const waitingAction = actions
    .filter((action) => action.kind === "launch_campaign")
    .filter((action) => ["proposed", "approved", "postponed"].includes(action.status))
    .filter((action) => resolveRefKey(action.ref, groups) === group.key)
    .sort((left, right) =>
      (right.decidedAt ?? right.createdAt).localeCompare(left.decidedAt ?? left.createdAt) ||
      left.id.localeCompare(right.id))[0];
  if (waitingAction) {
    return {
      value: "waiting",
      basis: "action",
      source: {
        kind: "action",
        actionId: waitingAction.id,
        status: waitingAction.status,
        at: waitingAction.decidedAt ?? waitingAction.createdAt,
      },
    };
  }

  const evidenceRows = rowsInWindow.length > 0 ? rowsInWindow : group.rows;
  if (evidenceRows.length === 0) return null;
  const dates = evidenceRows.map((row) => row.date).sort();
  return {
    value: rowsInWindow.length > 0 ? "recent_data" : "historical_data",
    basis: "metric_recency",
    source: sourceFor(
      evidenceRows,
      rowsInWindow.length > 0 ? window.from : dates[0],
      rowsInWindow.length > 0 ? window.to : dates.at(-1)!,
    ),
  };
}

function readingFor(performance: ObservedPerformance | null): CampaignAgentReading | null {
  if (!performance || performance.scope !== "selected_window") return null;
  const facts = performance.metrics;
  const verdict = facts.spend <= 0
    ? "no_positive_spend"
    : facts.conversions === 0
      ? "spend_without_conversion"
      : facts.revenue < facts.spend
        ? "revenue_below_spend"
        : "revenue_at_or_above_spend";
  return {
    kind: "observed_performance",
    verdict,
    facts,
    source: performance.source,
    confidence: { value: null, basis: "not_calibrated" },
  };
}

function isIncluded<T extends string>(selection: "all" | readonly T[], value: T): boolean {
  return selection === "all" || selection.includes(value);
}

function recommendationFor(campaigns: readonly CampaignCockpitItem[], window: CampaignCockpitRange): CampaignCockpitRecommendation | null {
  const blocked = campaigns
    .filter((campaign) => campaign.status.value === "blocked" && campaign.status.basis === "journal")
    .filter((campaign) => !campaign.attempts.some((attempt) => attempt.kind === "campaign_resolve_blocker"))
    .sort((left, right) => {
      const leftAt = left.status.basis === "journal" ? left.status.source.at : "";
      const rightAt = right.status.basis === "journal" ? right.status.source.at : "";
      return rightAt.localeCompare(leftAt) || left.key.localeCompare(right.key);
    })[0];
  if (blocked && blocked.status.basis === "journal") {
    return {
      priority: 1,
      kind: "resolve_observed_blocker",
      campaignKey: blocked.key,
      campaignId: blocked.campaignId,
      campaignName: blocked.campaignName,
      reason: "journal_blocker",
      evidence: {
        kind: "journal",
        journalId: blocked.status.source.journalId,
        event: blocked.status.source.event,
        at: blocked.status.source.at,
        reason: blocked.status.source.reason,
      },
      confidence: { value: null, basis: "not_calibrated" },
    };
  }

  const underperforming = campaigns
    .filter((campaign) =>
      campaign.reading?.verdict === "revenue_below_spend" ||
      campaign.reading?.verdict === "spend_without_conversion" &&
        (campaign.performance?.metrics.revenue ?? 0) < (campaign.performance?.metrics.spend ?? 0))
    .filter((campaign) => campaign.status.value !== "ended" && campaign.status.value !== "historical_data")
    .filter((campaign) => !campaign.attempts.some((attempt) => attempt.kind.startsWith("ads_pause_")))
    .sort((left, right) => {
      const leftLoss = (left.performance?.metrics.spend ?? 0) - (left.performance?.metrics.revenue ?? 0);
      const rightLoss = (right.performance?.metrics.spend ?? 0) - (right.performance?.metrics.revenue ?? 0);
      return rightLoss - leftLoss || left.key.localeCompare(right.key);
    })[0];
  if (!underperforming?.performance) return null;
  return {
    priority: 1,
    kind: "review_observed_underperformance",
    campaignKey: underperforming.key,
    campaignId: underperforming.campaignId,
    campaignName: underperforming.campaignName,
    reason: underperforming.reading?.verdict === "spend_without_conversion"
      ? "spend_without_observed_conversion"
      : "revenue_below_spend",
    evidence: {
      kind: "ad_metrics",
      ...underperforming.performance.metrics,
      period: window,
      rowCount: underperforming.performance.source.rowCount,
    },
    confidence: { value: null, basis: "not_calibrated" },
  };
}

/** Construit un snapshot reproductible ; toute ligne ambiguë fait échouer le lot. */
export function buildCampaignCockpit(input: BuildCampaignCockpitInput): BuildCampaignCockpitResult {
  const window = normalizeRange(input.window);
  if (!window) return { ok: false, error: "invalid_window" };
  const comparison = normalizeComparison(input.comparison, window);
  if (!comparison) return { ok: false, error: "invalid_comparison" };
  const filters = normalizeFilters(input.filters);
  if (!filters) return { ok: false, error: "invalid_filters" };
  if (!Array.isArray(input.rows)) return { ok: false, error: "rows_unavailable" };
  if (!Array.isArray(input.actions)) return { ok: false, error: "actions_unavailable" };
  if (!Array.isArray(input.journal)) return { ok: false, error: "journal_unavailable" };
  const rawProviderStatuses = input.providerStatuses === undefined ? [] : input.providerStatuses;
  if (!Array.isArray(rawProviderStatuses)) {
    return { ok: false, error: "provider_statuses_unavailable" };
  }

  const rows: NormalizedMetric[] = [];
  const metricKeys = new Set<string>();
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = normalizeMetric(input.rows[index]);
    if (!row) return { ok: false, error: "invalid_metric_row", invalidIndex: index };
    const metricKey = `${keyFor(row.provider, row.campaignId)}:${row.date}`;
    if (metricKeys.has(metricKey)) {
      return { ok: false, error: "duplicate_metric_row", invalidIndex: index };
    }
    metricKeys.add(metricKey);
    rows.push(row);
  }
  const actions: NormalizedAction[] = [];
  for (let index = 0; index < input.actions.length; index += 1) {
    const action = normalizeAction(input.actions[index]);
    if (!action) return { ok: false, error: "invalid_action_row", invalidIndex: index };
    actions.push(action);
  }
  const journal: NormalizedJournal[] = [];
  for (let index = 0; index < input.journal.length; index += 1) {
    const entry = normalizeJournal(input.journal[index]);
    if (!entry) return { ok: false, error: "invalid_journal_row", invalidIndex: index };
    journal.push(entry);
  }
  const providerStatuses: NormalizedProviderStatus[] = [];
  const providerStatusClaims = new Map<string, "active" | "ended">();
  for (let index = 0; index < rawProviderStatuses.length; index += 1) {
    const item = normalizeProviderStatus(rawProviderStatuses[index]);
    if (!item) return { ok: false, error: "invalid_provider_status_row", invalidIndex: index };
    const claimKey = `${keyFor(item.provider, item.campaignId)}:${item.observedAt}`;
    const existingClaim = providerStatusClaims.get(claimKey);
    if (existingClaim && existingClaim !== item.status) {
      return { ok: false, error: "conflicting_provider_status", invalidIndex: index };
    }
    providerStatusClaims.set(claimKey, item.status);
    providerStatuses.push(item);
  }

  const rowsAsOf = rows.filter((row) => row.date <= window.to);
  const actionsAsOf = actions.filter((action) => action.createdAt.slice(0, 10) <= window.to);
  const journalAsOf = journal.filter((entry) => entry.createdAt.slice(0, 10) <= window.to);
  const statusesAsOf = providerStatuses.filter((item) => item.observedAt.slice(0, 10) <= window.to);
  const groups = new Map<string, CampaignGroup>();
  for (const row of rowsAsOf) {
    const key = keyFor(row.provider, row.campaignId);
    const current = groups.get(key);
    if (current) current.rows.push(row);
    else groups.set(key, {
      key,
      provider: row.provider,
      channel: row.channel,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      internal: false,
      rows: [row],
    });
  }
  for (const group of groups.values()) {
    const latest = [...group.rows].sort((left, right) =>
      right.date.localeCompare(left.date) || right.syncedAt.localeCompare(left.syncedAt) ||
      left.campaignName.localeCompare(right.campaignName))[0];
    group.campaignName = latest.campaignName;
  }

  // Une proposition liée peut exister avant toute première ligne de métrique.
  for (const action of actionsAsOf) {
    if (action.kind !== "launch_campaign" || !action.ref?.provider || !action.ref.campaignName) continue;
    if (!["proposed", "approved", "postponed"].includes(action.status)) continue;
    const key = action.ref.internal
      ? internalKey(action.ref)
      : keyFor(action.ref.provider, action.ref.campaignId);
    if (!groups.has(key)) groups.set(key, {
      key,
      provider: action.ref.provider,
      channel: PROVIDER_CHANNEL[action.ref.provider],
      campaignId: action.ref.campaignId,
      campaignName: action.ref.campaignName,
      internal: action.ref.internal,
      rows: [],
    });
  }
  // Un blocage opérationnel journalisé reste visible même sans KPI disponible.
  for (const entry of journalAsOf) {
    if (!["campaign_waiting", "campaign_blocked"].includes(entry.event)) continue;
    if (!entry.reason || !entry.ref?.provider || !entry.ref.campaignName) continue;
    const key = keyFor(entry.ref.provider, entry.ref.campaignId);
    if (!groups.has(key)) groups.set(key, {
      key,
      provider: entry.ref.provider,
      channel: PROVIDER_CHANNEL[entry.ref.provider],
      campaignId: entry.ref.campaignId,
      campaignName: entry.ref.campaignName,
      internal: false,
      rows: [],
    });
  }

  const attempts = buildAttempts(actionsAsOf, journalAsOf, groups);
  const items: CampaignCockpitItem[] = [];
  for (const group of groups.values()) {
    const currentRows = group.rows.filter((row) => row.date >= window.from && row.date <= window.to);
    const previousRows = comparison.kind === "period"
      ? group.rows.filter((row) => row.date >= comparison.from && row.date <= comparison.to)
      : [];
    const historicalRows = group.rows.filter((row) => row.date < window.from);
    const performanceRows = currentRows.length > 0 ? currentRows : historicalRows;
    const performance = performanceRows.length === 0
      ? null
      : {
          kind: "observed" as const,
          scope: currentRows.length > 0 ? "selected_window" as const : "observed_history" as const,
          metrics: metricsFor(performanceRows),
          source: sourceFor(
            performanceRows,
            currentRows.length > 0 ? window.from : performanceRows.map((row) => row.date).sort()[0],
            currentRows.length > 0 ? window.to : performanceRows.map((row) => row.date).sort().at(-1)!,
          ),
        };
    const status = statusFor(
      group,
      currentRows,
      statusesAsOf,
      actionsAsOf,
      journalAsOf,
      window,
      groups,
    );
    if (!status) continue;
    const item: CampaignCockpitItem = {
      key: group.key,
      campaignId: group.campaignId,
      campaignName: group.campaignName,
      provider: group.provider,
      channel: group.channel,
      internal: group.internal,
      status,
      performance,
      comparison: comparisonFor(currentRows, previousRows, comparison, window),
      deliveryDiagnostic: deliveryDiagnosticFor(currentRows, previousRows, comparison, window),
      reading: readingFor(performance),
      attempts: attempts.filter((attempt) => attempt.campaignKey === group.key),
    };
    if (isIncluded(filters.channels, item.channel) && isIncluded(filters.statuses, item.status.value)) {
      items.push(item);
    }
  }
  items.sort((left, right) => {
    const rank: Record<CampaignCockpitStatus, number> = {
      blocked: 0,
      waiting: 1,
      active: 2,
      recent_data: 3,
      ended: 4,
      historical_data: 5,
    };
    const spendDifference = (right.performance?.metrics.spend ?? -1) - (left.performance?.metrics.spend ?? -1);
    return rank[left.status.value] - rank[right.status.value] || spendDifference || left.key.localeCompare(right.key);
  });

  const includedKeys = new Set(items.map((item) => item.key));
  const currentRows = rowsAsOf.filter((row) => row.date >= window.from && row.date <= window.to)
    .filter((row) => includedKeys.has(keyFor(row.provider, row.campaignId)));
  const previousRows = comparison.kind === "period"
    ? rowsAsOf.filter((row) => row.date >= comparison.from && row.date <= comparison.to)
      .filter((row) => includedKeys.has(keyFor(row.provider, row.campaignId)))
    : [];
  const totals = currentRows.length === 0
    ? { status: "unavailable" as const, reason: "no_rows_in_window" as const, metrics: null }
    : {
        status: "available" as const,
        metrics: metricsFor(currentRows),
        source: sourceFor(currentRows, window.from, window.to),
      };
  const linkedJournalIds = new Set(attempts.flatMap((attempt) => attempt.journalEvents.map((entry) => entry.id)));
  const campaignActionIds = new Set(attempts.map((attempt) => attempt.actionId));

  return {
    ok: true,
    cockpit: {
      window,
      comparisonPeriod: comparison,
      filters,
      totals,
      comparison: comparisonFor(currentRows, previousRows, comparison, window),
      deliveryDiagnostic: deliveryDiagnosticFor(currentRows, previousRows, comparison, window),
      campaigns: items,
      recommendation: recommendationFor(items, window),
      history: {
        attempts,
        unlinkedJournalEvents: journalAsOf
          .filter((entry) =>
            entry.ref !== null || entry.event.startsWith("campaign_") || entry.event.startsWith("ads_") ||
            entry.actionId !== null && campaignActionIds.has(entry.actionId))
          .filter((entry) => !linkedJournalIds.has(entry.id))
          .map((entry) => ({ id: entry.id, event: entry.event, at: entry.createdAt }))
          .sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id)),
      },
      provenance: {
        metricRows: rows.length,
        actionRows: actions.length,
        journalRows: journal.length,
        providerStatusRows: providerStatuses.length,
        futureMetricRowsExcluded: rows.length - rowsAsOf.length,
      },
    },
  };
}
