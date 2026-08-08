/**
 * CAMP-1 — preuve historique et projections prudentes, sans I/O.
 *
 * Les faits sont agrégés sur une fenêtre calendaire explicite. Une projection
 * n'est rendue que lorsque l'historique franchit tous les seuils de suffisance.
 * Aucun benchmark de canal n'est utilisé : les estimations dérivent uniquement
 * des faits observés fournis à ce module.
 */

export const CAMPAIGN_EVIDENCE_WINDOW_DAYS = 30;

export const CAMPAIGN_EVIDENCE_SUFFICIENCY = Object.freeze({
  minDistinctDays: 7,
  minSpendExclusive: 0,
  minConversions: 10,
});

export const CAMPAIGN_PROJECTION_INTERVAL = Object.freeze({
  relativeMargin: 0.3,
  label: "Bande de planification prudente de ±30 %",
  basis:
    "Intervalle heuristique appliqué à l'historique observé ; ce n'est pas un intervalle statistique calibré.",
});

export type CampaignEvidenceProvider =
  | "meta_ads"
  | "google_ads"
  | "linkedin_ads";

export interface CampaignEvidenceProviderMetadata {
  provider: CampaignEvidenceProvider;
  label: string;
}

const CHANNEL_PROVIDERS: Readonly<
  Record<string, CampaignEvidenceProviderMetadata>
> = Object.freeze({
  meta: { provider: "meta_ads", label: "Meta Ads" },
  google: { provider: "google_ads", label: "Google Ads" },
  linkedin: { provider: "linkedin_ads", label: "LinkedIn Ads" },
});

export function campaignEvidenceProviderForChannel(
  channel: unknown,
): CampaignEvidenceProviderMetadata | null {
  if (typeof channel !== "string") return null;
  return CHANNEL_PROVIDERS[channel.trim().toLowerCase()] ?? null;
}

export interface NormalizedAdMetricRow {
  provider: CampaignEvidenceProvider;
  campaignId: string;
  campaignName: string;
  date: string;
  spend: number;
  conversions: number;
  revenue: number;
  syncedAt: string;
}

export type AdMetricRowsNormalization =
  | { ok: true; rows: NormalizedAdMetricRow[] }
  | {
      ok: false;
      error: "rows_unavailable" | "invalid_row";
      invalidIndex?: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = nonNegativeNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
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

function normalizeAdMetricRow(input: unknown): NormalizedAdMetricRow | null {
  if (!isRecord(input)) return null;

  const provider = normalizedText(input.provider);
  const campaignId = normalizedText(input.campaign_id);
  const campaignName = normalizedText(input.campaign_name);
  const date = isoDate(input.date);
  const spend = nonNegativeNumber(input.spend);
  const conversions = nonNegativeInteger(input.conversions);
  const revenue = nonNegativeNumber(input.revenue);
  const syncedAt = isoTimestamp(input.synced_at);

  if (
    !provider ||
    !["meta_ads", "google_ads", "linkedin_ads"].includes(provider) ||
    !campaignId ||
    !campaignName ||
    !date ||
    spend === null ||
    conversions === null ||
    revenue === null ||
    !syncedAt
  ) {
    return null;
  }

  return {
    provider: provider as CampaignEvidenceProvider,
    campaignId,
    campaignName,
    date,
    spend,
    conversions,
    revenue,
    syncedAt,
  };
}

/** Normalise les nombres Postgres sérialisés et refuse toute ligne ambiguë. */
export function normalizeAdMetricRows(rows: unknown): AdMetricRowsNormalization {
  if (!Array.isArray(rows)) return { ok: false, error: "rows_unavailable" };

  const normalized: NormalizedAdMetricRow[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = normalizeAdMetricRow(rows[index]);
    if (!row) return { ok: false, error: "invalid_row", invalidIndex: index };
    normalized.push(row);
  }
  return { ok: true, rows: normalized };
}

export type CampaignEvidenceStatus =
  | "available"
  | "insufficient"
  | "unavailable";

export type CampaignEvidenceReason =
  | "invalid_channel"
  | "invalid_window_end"
  | "rows_unavailable"
  | "invalid_provider_rows"
  | "no_rows_in_window"
  | "fewer_than_7_distinct_days"
  | "no_positive_spend"
  | "fewer_than_10_conversions";

export interface CampaignEvidenceSource {
  provider: CampaignEvidenceProvider | null;
  label: string;
  from: string | null;
  to: string | null;
  rowCount: number;
  campaignCount: number;
  lastSyncedAt: string | null;
}

export interface CampaignObservedFacts {
  kind: "observed";
  spend: number;
  conversions: number;
  revenue: number;
  cac: number | null;
  roas: number | null;
  topCampaign: {
    campaignId: string;
    campaignName: string;
    spend: number;
    conversions: number;
    revenue: number;
    cac: number | null;
    roas: number | null;
  } | null;
}

export interface CampaignEvidenceMethod {
  kind: "observed_aggregate";
  windowDays: number;
  aggregation: string;
  sufficiency: typeof CAMPAIGN_EVIDENCE_SUFFICIENCY;
}

export interface CampaignEvidence {
  status: CampaignEvidenceStatus;
  source: CampaignEvidenceSource;
  facts: CampaignObservedFacts | null;
  distinctDays: number;
  reasons: CampaignEvidenceReason[];
  method: CampaignEvidenceMethod;
}

const EVIDENCE_METHOD: CampaignEvidenceMethod = Object.freeze({
  kind: "observed_aggregate",
  windowDays: CAMPAIGN_EVIDENCE_WINDOW_DAYS,
  aggregation:
    "Somme des lignes ad_metrics du fournisseur sur 30 jours calendaires inclusifs ; CAC = dépense / conversions et ROAS = revenu / dépense.",
  sufficiency: CAMPAIGN_EVIDENCE_SUFFICIENCY,
});

function daysBefore(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function emptySource(
  provider: CampaignEvidenceProviderMetadata | null,
  from: string | null,
  to: string | null,
): CampaignEvidenceSource {
  return {
    provider: provider?.provider ?? null,
    label: provider?.label ?? "Canal non pris en charge",
    from,
    to,
    rowCount: 0,
    campaignCount: 0,
    lastSyncedAt: null,
  };
}

function unavailableEvidence(
  source: CampaignEvidenceSource,
  reason: CampaignEvidenceReason,
): CampaignEvidence {
  return {
    status: "unavailable",
    source,
    facts: null,
    distinctDays: 0,
    reasons: [reason],
    method: EVIDENCE_METHOD,
  };
}

export interface BuildCampaignEvidenceInput {
  channel: unknown;
  rows: unknown;
  /** Fin incluse de la fenêtre, au format YYYY-MM-DD. */
  windowEnd: unknown;
}

/**
 * Construit une preuve explicable depuis les seules lignes du fournisseur lié
 * au canal. Les autres fournisseurs sont ignorés et les dates futures exclues.
 */
export function buildCampaignEvidence({
  channel,
  rows,
  windowEnd,
}: BuildCampaignEvidenceInput): CampaignEvidence {
  const provider = campaignEvidenceProviderForChannel(channel);
  const to = isoDate(windowEnd);
  const from = to ? daysBefore(to, CAMPAIGN_EVIDENCE_WINDOW_DAYS - 1) : null;
  const source = emptySource(provider, from, to);

  if (!provider) return unavailableEvidence(source, "invalid_channel");
  if (!to || !from) return unavailableEvidence(source, "invalid_window_end");
  if (!Array.isArray(rows)) return unavailableEvidence(source, "rows_unavailable");

  const providerRows = rows.filter(
    (row) => isRecord(row) && normalizedText(row.provider) === provider.provider,
  );
  const normalized = normalizeAdMetricRows(providerRows);
  if (!normalized.ok) {
    return unavailableEvidence(source, "invalid_provider_rows");
  }

  const inWindow = normalized.rows.filter(
    (row) => row.date >= from && row.date <= to,
  );
  if (inWindow.length === 0) {
    return unavailableEvidence(source, "no_rows_in_window");
  }

  const spend = roundTo(inWindow.reduce((sum, row) => sum + row.spend, 0), 2);
  const conversions = inWindow.reduce((sum, row) => sum + row.conversions, 0);
  const revenue = roundTo(inWindow.reduce((sum, row) => sum + row.revenue, 0), 2);
  const distinctDays = new Set(inWindow.map((row) => row.date)).size;
  const campaignCount = new Set(inWindow.map((row) => row.campaignId)).size;
  const lastSyncedAt = inWindow
    .map((row) => row.syncedAt)
    .sort()
    .at(-1) ?? null;
  const campaigns = new Map<
    string,
    { campaignId: string; campaignName: string; spend: number; conversions: number; revenue: number }
  >();
  for (const row of inWindow) {
    const current = campaigns.get(row.campaignId) ?? {
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      spend: 0,
      conversions: 0,
      revenue: 0,
    };
    current.spend += row.spend;
    current.conversions += row.conversions;
    current.revenue += row.revenue;
    campaigns.set(row.campaignId, current);
  }
  const top = [...campaigns.values()].sort((left, right) => {
    if (left.conversions !== right.conversions) return right.conversions - left.conversions;
    const leftRoas = left.spend > 0 ? left.revenue / left.spend : 0;
    const rightRoas = right.spend > 0 ? right.revenue / right.spend : 0;
    if (leftRoas !== rightRoas) return rightRoas - leftRoas;
    return left.campaignId.localeCompare(right.campaignId);
  })[0];

  const facts: CampaignObservedFacts = {
    kind: "observed",
    spend,
    conversions,
    revenue,
    cac: conversions > 0 ? roundTo(spend / conversions, 2) : null,
    roas: spend > 0 ? roundTo(revenue / spend, 2) : null,
    topCampaign: top
      ? {
          ...top,
          spend: roundTo(top.spend, 2),
          revenue: roundTo(top.revenue, 2),
          cac: top.conversions > 0 ? roundTo(top.spend / top.conversions, 2) : null,
          roas: top.spend > 0 ? roundTo(top.revenue / top.spend, 2) : null,
        }
      : null,
  };

  const reasons: CampaignEvidenceReason[] = [];
  if (distinctDays < CAMPAIGN_EVIDENCE_SUFFICIENCY.minDistinctDays) {
    reasons.push("fewer_than_7_distinct_days");
  }
  if (spend <= CAMPAIGN_EVIDENCE_SUFFICIENCY.minSpendExclusive) {
    reasons.push("no_positive_spend");
  }
  if (conversions < CAMPAIGN_EVIDENCE_SUFFICIENCY.minConversions) {
    reasons.push("fewer_than_10_conversions");
  }

  return {
    status: reasons.length === 0 ? "available" : "insufficient",
    source: {
      provider: provider.provider,
      label: provider.label,
      from,
      to,
      rowCount: inWindow.length,
      campaignCount,
      lastSyncedAt,
    },
    facts,
    distinctDays,
    reasons,
    method: EVIDENCE_METHOD,
  };
}

export interface CampaignProjectionRange {
  estimate: number;
  low: number;
  high: number;
}

export interface CampaignProjection {
  kind: "estimate";
  basedOn: "observed_30_day_history";
  budget: number;
  costPerContact: CampaignProjectionRange;
  volume: CampaignProjectionRange;
  roas: CampaignProjectionRange;
  interval: typeof CAMPAIGN_PROJECTION_INTERVAL;
  confidence: number;
  limits: string[];
}

export type CampaignProjectionResult =
  | { status: "available"; projection: CampaignProjection }
  | {
      status: "unavailable";
      reason:
        | "invalid_budget"
        | "insufficient_evidence"
        | "unavailable_evidence";
      projection: null;
    };

const PROJECTION_LIMITS = Object.freeze([
  "Projection fondée sur l'historique observé, pas sur une relation causale.",
  "Les changements d'audience, de création, d'enchère ou de marché ne sont pas modélisés.",
  "L'attribution et les conversions retardées restent celles des données du fournisseur.",
  "La bande de ±30 % est une marge de planification heuristique, pas une garantie statistique.",
]);

/**
 * Dérive une projection uniquement d'une preuve `available`. L'intervalle
 * prudent de ±30 % est appliqué au CAC et au ROAS observés ; la fourchette de
 * volume utilise les deux bornes de coût, sans benchmark externe.
 */
export function buildCampaignProjection(
  evidence: CampaignEvidence,
  totalBudget: unknown,
): CampaignProjectionResult {
  if (typeof totalBudget !== "number" || !Number.isFinite(totalBudget) || totalBudget <= 0) {
    return { status: "unavailable", reason: "invalid_budget", projection: null };
  }
  if (evidence.status !== "available" || !evidence.facts) {
    return {
      status: "unavailable",
      reason:
        evidence.status === "insufficient"
          ? "insufficient_evidence"
          : "unavailable_evidence",
      projection: null,
    };
  }

  const { cac, roas } = evidence.facts;
  if (cac === null || cac <= 0 || roas === null) {
    return { status: "unavailable", reason: "unavailable_evidence", projection: null };
  }

  const margin = CAMPAIGN_PROJECTION_INTERVAL.relativeMargin;
  const costLow = roundTo(cac * (1 - margin), 2);
  const costHigh = roundTo(cac * (1 + margin), 2);
  const roasLow = roundTo(Math.max(0, roas * (1 - margin)), 2);
  const roasHigh = roundTo(roas * (1 + margin), 2);

  return {
    status: "available",
    projection: {
      kind: "estimate",
      basedOn: "observed_30_day_history",
      budget: roundTo(totalBudget, 2),
      costPerContact: { estimate: cac, low: costLow, high: costHigh },
      volume: {
        estimate: Math.floor(totalBudget / cac),
        low: Math.floor(totalBudget / costHigh),
        high: Math.floor(totalBudget / costLow),
      },
      roas: { estimate: roas, low: roasLow, high: roasHigh },
      interval: CAMPAIGN_PROJECTION_INTERVAL,
      confidence: 0.6,
      limits: [...PROJECTION_LIMITS],
    },
  };
}
