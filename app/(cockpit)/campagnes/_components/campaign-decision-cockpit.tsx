"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CampaignAnalyticQuestionId } from "@/lib/campaign-insights";

const ALL_FILTER = "__all__";

export type CampaignTone = "neutral" | "positive" | "warning" | "negative";

export interface CampaignEvidenceReference {
  label: string;
  periodLabel?: string;
  observedAtLabel?: string;
}

export interface CampaignDecisionPeriod {
  label: string;
  startLabel: string;
  endLabel: string;
  comparison:
    | {
        label: string;
        startLabel: string;
        endLabel: string;
      }
    | null;
  comparisonUnavailableReason?: string;
}

export type CampaignCockpitDataState =
  | { kind: "ready" }
  | {
      kind: "empty";
      code?: "empty_filter_result";
      description: string;
    }
  | { kind: "insufficient"; description: string };

export type CampaignObservedValue =
  | {
      state: "available";
      value: string;
      source: CampaignEvidenceReference;
      comparison?: {
        value: string;
        tone?: CampaignTone;
      } | null;
    }
  | {
      state: "insufficient" | "unavailable";
      reason: string;
      source?: CampaignEvidenceReference | null;
    };

export interface CampaignObservedKpi {
  id: string;
  label: string;
  observation: CampaignObservedValue;
}

export type CampaignConfidence =
  | {
      state: "calculated";
      level: "high" | "medium" | "low";
      reason: string;
    }
  | {
      state: "not_calculated";
      reason: string;
    };

export interface CampaignAgentReading {
  summary: string;
  source: CampaignEvidenceReference | null;
  confidence: CampaignConfidence;
}

export interface CampaignDeliveryReading {
  state: "available" | "unavailable";
  summary: string;
  disclaimer: string;
  source: CampaignEvidenceReference | null;
  confidence: CampaignConfidence;
}

export interface CampaignPriorityRecommendation extends CampaignAgentReading {
  title: string;
}

export type CampaignStatusEvidence =
  | {
      kind: "observed";
      source: CampaignEvidenceReference;
    }
  | {
      kind: "derived";
      rule: string;
      source?: CampaignEvidenceReference | null;
    };

export interface CampaignDecisionStatus {
  id: string;
  label: string;
  tone: CampaignTone;
  /**
   * « Active », « terminée », « en attente » ou « bloquée » exigent une
   * preuve observée. Une classification par date seule doit rester dérivée et
   * porter un libellé de récence (par exemple « Données récentes »).
   */
  evidence: CampaignStatusEvidence;
}

export interface CampaignMetricCell {
  label: string;
  observation: CampaignObservedValue;
}

export interface CampaignDecisionRow {
  id: string;
  name: string;
  channel: {
    id: string;
    label: string;
  };
  status: CampaignDecisionStatus;
  source: CampaignEvidenceReference | null;
  spend: CampaignMetricCell;
  acquisitionCost: CampaignMetricCell;
  results: CampaignMetricCell;
  revenue: CampaignMetricCell;
  roas: CampaignMetricCell;
  cpm: CampaignMetricCell;
  ctr: CampaignMetricCell;
  deliveryDiagnostic: CampaignDeliveryReading;
  agentReading: CampaignAgentReading | null;
}

export interface CampaignPastAttempt {
  id: string;
  name: string;
  channel: {
    id: string;
    label: string;
  };
  periodLabel: string;
  outcome: string;
  learning: string | null;
  source: CampaignEvidenceReference;
}

export interface CampaignDailySummary {
  text: string;
  source: CampaignEvidenceReference;
}

export interface CampaignActivityEvent {
  id: string;
  title: string;
  detail: string;
  atLabel: string;
  source: CampaignEvidenceReference;
}

export interface CampaignCockpitFilters {
  channel: string;
  status: string;
  channelOptions: Array<{ id: string; label: string }>;
  statusOptions: Array<{ id: string; label: string }>;
}

export interface CampaignOperationalFact {
  state: "available" | "unavailable";
  label: string;
  value: string;
  detail: string;
}

export interface CampaignOperationalSummary {
  agent: CampaignOperationalFact;
  connectors: CampaignOperationalFact;
  lastAnalysis: CampaignOperationalFact;
}

export interface CampaignProspectSearchResult {
  id: string;
  name: string;
  company: string | null;
  source: string;
  syncedAtLabel: string;
}

export interface CampaignProspectSearch {
  state: "idle" | "ready" | "empty" | "invalid" | "unavailable";
  query: string;
  message: string;
  results: CampaignProspectSearchResult[];
}

export interface CampaignWeeklyMetricView {
  id: string;
  label: string;
  current: string;
  previous: string;
  change: string;
}

export interface CampaignWeeklyReportView {
  state: "available" | "unavailable";
  reason: string | null;
  currentPeriodLabel: string;
  previousPeriodLabel: string | null;
  source: CampaignEvidenceReference | null;
  sourceDetail: string;
  metrics: CampaignWeeklyMetricView[];
  coverage: string | null;
}

export interface CampaignAnalyticQuestionView {
  id: CampaignAnalyticQuestionId;
  label: string;
  answer: {
    state: "available" | "unavailable";
    summary: string;
    details: string[];
    periodLabel: string;
    source: CampaignEvidenceReference | null;
    sourceDetail: string;
  };
}

export interface CampaignWeeklyInsights {
  report: CampaignWeeklyReportView;
  questions: CampaignAnalyticQuestionView[];
}

export interface CampaignDecisionCockpitProps {
  dataState: CampaignCockpitDataState;
  period: CampaignDecisionPeriod;
  kpis: CampaignObservedKpi[];
  deliveryDiagnostic: CampaignDeliveryReading | null;
  recommendation: CampaignPriorityRecommendation | null;
  campaigns: CampaignDecisionRow[];
  pastAttempts: CampaignPastAttempt[];
  dailySummary: CampaignDailySummary | null;
  activity: CampaignActivityEvent[];
  filters: CampaignCockpitFilters;
  operationalSummary: CampaignOperationalSummary;
  prospectSearch: CampaignProspectSearch;
  prospectPresentation: string;
  weeklyInsights: CampaignWeeklyInsights;
}

export function CampaignDecisionCockpit({
  dataState,
  period,
  kpis,
  deliveryDiagnostic,
  recommendation,
  campaigns,
  pastAttempts,
  dailySummary,
  activity,
  filters,
  operationalSummary,
  prospectSearch,
  prospectPresentation,
  weeklyInsights,
}: CampaignDecisionCockpitProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();
  const channelFilterId = useId();
  const statusFilterId = useId();
  const prospectSearchId = useId();
  const [search, setSearch] = useState("");

  const channelOptions = useMemo(
    () => uniqueOptions(filters.channelOptions),
    [filters.channelOptions],
  );
  const statusOptions = useMemo(
    () => uniqueOptions(filters.statusOptions),
    [filters.statusOptions],
  );

  const effectiveChannel = channelOptions.some(
    (option) => option.id === filters.channel,
  )
    ? filters.channel
    : ALL_FILTER;
  const effectiveStatus = statusOptions.some(
    (option) => option.id === filters.status,
  )
    ? filters.status
    : ALL_FILTER;
  const updateServerFilter = (name: "channel" | "status", value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("proposed");
    if (value === ALL_FILTER) next.delete(name);
    else next.set(name, value);
    const query = next.toString();
    router.replace(query ? `?${query}` : "/campagnes", { scroll: false });
  };
  const clearProspectSearch = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("prospect");
    next.delete("proposed");
    const query = next.toString();
    router.replace(query ? `?${query}` : "/campagnes", { scroll: false });
  };
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const matchesSearch = (...values: string[]) =>
    normalizedSearch === "" ||
    values.some((value) =>
      value.toLocaleLowerCase("fr").includes(normalizedSearch),
    );

  const visibleCampaigns = campaigns.filter(
    (campaign) =>
      (effectiveChannel === ALL_FILTER ||
        campaign.channel.id === effectiveChannel) &&
      (effectiveStatus === ALL_FILTER ||
        campaign.status.id === effectiveStatus) &&
      matchesSearch(
        campaign.name,
        campaign.channel.label,
        campaign.status.label,
      ),
  );
  const visibleAttempts = pastAttempts.filter(
    (attempt) =>
      (effectiveChannel === ALL_FILTER ||
        attempt.channel.id === effectiveChannel) &&
      matchesSearch(attempt.name, attempt.channel.label, attempt.outcome),
  );
  const hasFilterableData =
    campaigns.length > 0 ||
    pastAttempts.length > 0 ||
    channelOptions.length > 0 ||
    statusOptions.length > 0;

  return (
    <section aria-labelledby="campaign-decision-title" className="space-y-4">
      <div className="rounded-[18px] border border-line-soft bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
              Mesure observée
            </p>
            <h2
              id="campaign-decision-title"
              className="mt-1 font-display text-[18px] font-semibold text-ink"
            >
              Cockpit de décision
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
              Les valeurs affichées viennent uniquement des sources indiquées.
              Une prévision, lorsqu&apos;elle existe ailleurs, n&apos;est pas
              mélangée à ces observations.
            </p>
          </div>

          {hasFilterableData && (
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[680px] xl:grid-cols-3">
            <label htmlFor={searchId} className="text-[11px] font-semibold text-faint">
              Rechercher
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom de campagne"
                className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-body transition-colors focus:border-violet motion-reduce:transition-none"
              />
            </label>
            {channelOptions.length > 0 && <label
              htmlFor={channelFilterId}
              className="text-[11px] font-semibold text-faint"
            >
              Canal observé dans les données
              <select
                id={channelFilterId}
                value={effectiveChannel}
                onChange={(event) =>
                  updateServerFilter("channel", event.target.value)
                }
                className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-body transition-colors focus:border-violet motion-reduce:transition-none"
              >
                <option value={ALL_FILTER}>Tous les canaux présents</option>
                {channelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>}
            {statusOptions.length > 0 && <label
              htmlFor={statusFilterId}
              className="text-[11px] font-semibold text-faint"
            >
              État documenté
              <select
                id={statusFilterId}
                value={effectiveStatus}
                onChange={(event) =>
                  updateServerFilter("status", event.target.value)
                }
                className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-body transition-colors focus:border-violet motion-reduce:transition-none"
              >
                <option value={ALL_FILTER}>Tous les états présents</option>
                {statusOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>}
          </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 border-t border-line-soft pt-4 md:grid-cols-2">
          <PeriodLine
            eyebrow="Période analysée"
            label={period.label}
            startLabel={period.startLabel}
            endLabel={period.endLabel}
          />
          {period.comparison ? (
            <PeriodLine
              eyebrow="Comparaison"
              label={period.comparison.label}
              startLabel={period.comparison.startLabel}
              endLabel={period.comparison.endLabel}
              note={
                period.comparisonUnavailableReason
                  ? `Comparaison indisponible : ${period.comparisonUnavailableReason}`
                  : undefined
              }
            />
          ) : (
            <div className="rounded-[11px] bg-tint-soft px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-faint">
                Comparaison
              </p>
              <p className="mt-1 text-[12px] font-semibold text-body">
                Non disponible
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                {period.comparisonUnavailableReason ??
                  "Aucune période comparable n’a été fournie."}
              </p>
            </div>
          )}
        </div>
      </div>

      <DataStateNotice state={dataState} />

      <OperationalSummary summary={operationalSummary} />

      <ProspectSearchPanel
        search={prospectSearch}
        presentation={prospectPresentation}
        inputId={prospectSearchId}
        channel={effectiveChannel === ALL_FILTER ? null : effectiveChannel}
        status={effectiveStatus === ALL_FILTER ? null : effectiveStatus}
        onClear={clearProspectSearch}
      />

      {dailySummary && (
        <section aria-labelledby="campaign-daily-summary-title" className="rounded-[14px] border border-line-soft bg-white px-4 py-3.5 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-violet">
            Résumé du jour
          </p>
          <h3 id="campaign-daily-summary-title" className="sr-only">
            Résumé factuel du jour
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-body">
            {dailySummary.text}
          </p>
          <EvidenceReference source={dailySummary.source} className="mt-1.5" />
        </section>
      )}

      <section aria-labelledby="campaign-kpis-title">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3
              id="campaign-kpis-title"
              className="font-display text-[15px] font-semibold text-ink"
            >
              Indicateurs observés
            </h3>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Période et provenance restent visibles sur chaque indicateur.
            </p>
          </div>
          <p className="text-[11px] text-faint">{period.label}</p>
        </div>
        {kpis.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            {kpis.map((kpi) => (
              <ObservedKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        ) : (
          <InlineEmptyState>
            Aucun indicateur reproductible n&apos;est disponible pour cette
            période.
          </InlineEmptyState>
        )}
      </section>

      {deliveryDiagnostic && (
        <DeliveryDiagnosticPanel diagnostic={deliveryDiagnostic} />
      )}

      <WeeklyInsightsPanel insights={weeklyInsights} />

      <CreativeAuditUnavailable />

      <PriorityRecommendation recommendation={recommendation} />

      <section
        aria-labelledby="campaigns-measured-title"
        className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card"
      >
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line-soft px-4 py-4 sm:px-[22px]">
          <div>
            <h3
              id="campaigns-measured-title"
              className="font-display text-[15px] font-semibold text-ink"
            >
              Campagnes mesurées
            </h3>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Performance et livraison observées, état justifié et lectures
              descriptives.
            </p>
          </div>
          <p className="text-[11px] tabular-nums text-faint" aria-live="polite">
            {visibleCampaigns.length} résultat
            {visibleCampaigns.length > 1 ? "s" : ""}
          </p>
        </div>

        {visibleCampaigns.length === 0 ? (
          <div className="px-4 py-7 sm:px-[22px]">
            <InlineEmptyState>
              {campaigns.length === 0
                ? "Aucune campagne observée n’est disponible pour cette période."
                : "Aucune campagne ne correspond à ces filtres."}
            </InlineEmptyState>
          </div>
        ) : (
          <>
            <CampaignTable campaigns={visibleCampaigns} />
            <CampaignCards campaigns={visibleCampaigns} />
          </>
        )}
      </section>

      <section
        aria-labelledby="campaign-attempts-title"
        className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card"
      >
        <div className="border-b border-line-soft px-4 py-4 sm:px-[22px]">
          <h3
            id="campaign-attempts-title"
            className="font-display text-[15px] font-semibold text-ink"
          >
            Historique des décisions
          </h3>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-muted">
            Validations, refus et reports sourcés. Un statut de décision ne
            constitue jamais une preuve de lancement ou de résultat fournisseur.
          </p>
        </div>
        {visibleAttempts.length > 0 ? (
          <ul className="divide-y divide-line-soft">
            {visibleAttempts.map((attempt) => (
              <li key={attempt.id} className="px-4 py-3.5 sm:px-[22px]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[13px] font-semibold text-ink">
                        {attempt.name}
                      </h4>
                      <span className="rounded-full bg-tint-soft px-2 py-0.5 text-[10.5px] font-semibold text-body">
                        {attempt.channel.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-body">
                      {attempt.outcome}
                    </p>
                    {attempt.learning && (
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                        <span className="font-semibold text-body">
                          Motif enregistré :
                        </span>{" "}
                        {attempt.learning}
                      </p>
                    )}
                  </div>
                  <div className="flex-none text-[10.5px] leading-relaxed text-faint sm:max-w-[260px] sm:text-right">
                    <p>{attempt.periodLabel}</p>
                    <EvidenceReference source={attempt.source} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-7 sm:px-[22px]">
            <InlineEmptyState>
              {pastAttempts.length === 0
                ? "Aucune décision antérieure sourcée n’est disponible."
                : "Aucune décision antérieure ne correspond au canal sélectionné."}
            </InlineEmptyState>
          </div>
        )}
      </section>

      {activity.length > 0 && (
        <section aria-labelledby="campaign-activity-title" className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="border-b border-line-soft px-4 py-4 sm:px-[22px]">
            <h3 id="campaign-activity-title" className="font-display text-[15px] font-semibold text-ink">
              Activité vérifiable
            </h3>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Uniquement les événements enregistrés dans le journal CAMP-2.
            </p>
          </div>
          <ol className="divide-y divide-line-soft">
            {activity.map((event) => (
              <li key={event.id} className="px-4 py-3 sm:px-[22px]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink">{event.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-body">{event.detail}</p>
                  </div>
                  <p className="flex-none text-[10.5px] tabular-nums text-faint">{event.atLabel}</p>
                </div>
                <EvidenceReference source={event.source} className="mt-1" />
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

function PeriodLine({
  eyebrow,
  label,
  startLabel,
  endLabel,
  note,
}: {
  eyebrow: string;
  label: string;
  startLabel: string;
  endLabel: string;
  note?: string;
}) {
  return (
    <div className="rounded-[11px] bg-tint-soft px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-faint">
        {eyebrow}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-ink">{label}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted">
        {startLabel} → {endLabel}
      </p>
      {note && (
        <p className="mt-1 text-[10.5px] leading-relaxed text-amber">{note}</p>
      )}
    </div>
  );
}

function DataStateNotice({ state }: { state: CampaignCockpitDataState }) {
  if (state.kind === "ready") return null;

  const insufficient = state.kind === "insufficient";
  const emptyFilterResult =
    state.kind === "empty" && state.code === "empty_filter_result";
  return (
    <div
      role="status"
      className={`rounded-[13px] border px-4 py-3 ${
        insufficient
          ? "border-amber/30 bg-amber-tint"
          : "border-line-soft bg-white"
      }`}
    >
      <p
        className={`text-[12.5px] font-semibold ${
          insufficient ? "text-amber" : "text-ink"
        }`}
      >
        {insufficient
          ? "Données insuffisantes"
          : emptyFilterResult
            ? "Aucun résultat pour ces filtres"
            : "Aucune donnée observée"}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-body">
        {state.description}
      </p>
    </div>
  );
}

function OperationalSummary({
  summary,
}: {
  summary: CampaignOperationalSummary;
}) {
  return (
    <section
      aria-labelledby="campaign-operational-summary-title"
      className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card sm:p-5"
    >
      <div>
        <h3
          id="campaign-operational-summary-title"
          className="font-display text-[15px] font-semibold text-ink"
        >
          Résumé opérationnel
        </h3>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          Contrôles persistés et inventaire relus pour cette organisation ;
          aucun état d&apos;activité n&apos;est simulé.
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[summary.agent, summary.connectors, summary.lastAnalysis].map((fact) => (
          <article
            key={fact.label}
            className="rounded-[12px] border border-line-soft bg-tint-soft/40 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-faint">
                {fact.label}
              </h4>
              <span
                className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.04em] ${
                  fact.state === "available"
                    ? "bg-green-tint text-green"
                    : "bg-amber-tint text-amber"
                }`}
              >
                {fact.state === "available" ? "Persisté" : "Indisponible"}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-ink">
              {fact.value}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {fact.detail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProspectSearchPanel({
  search,
  presentation,
  inputId,
  channel,
  status,
  onClear,
}: {
  search: CampaignProspectSearch;
  presentation: string;
  inputId: string;
  channel: string | null;
  status: string | null;
  onClear: () => void;
}) {
  const problem = search.state === "invalid" || search.state === "unavailable";
  return (
    <section
      aria-labelledby="campaign-prospect-search-title"
      className="overflow-hidden rounded-[16px] border border-line-soft bg-white shadow-card"
    >
      <div className="border-b border-line-soft px-4 py-4 sm:px-5">
        <h3
          id="campaign-prospect-search-title"
          className="font-display text-[15px] font-semibold text-ink"
        >
          Prospects synchronisés
        </h3>
        <p className="mt-0.5 max-w-3xl text-[11.5px] leading-relaxed text-muted">
          Recherche en lecture seule par nom ou société. Seuls le nom, la
          société, la source et la date de synchronisation sont relus ; aucun
          email, contenu brut ou note interne n&apos;est sélectionné.
        </p>
        <p className="mt-1 text-[10.5px] font-semibold text-violet">
          Origine présentée : {presentation}
        </p>
        <form
          role="search"
          action="/campagnes"
          method="get"
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          {channel && <input type="hidden" name="channel" value={channel} />}
          {status && <input type="hidden" name="status" value={status} />}
          <label
            htmlFor={inputId}
            className="min-w-0 flex-1 text-[11px] font-semibold text-faint"
          >
            Nom ou société
            <input
              key={search.query}
              id={inputId}
              name="prospect"
              type="search"
              defaultValue={search.query}
              minLength={2}
              maxLength={80}
              autoComplete="off"
              placeholder="Ex. Dupont ou Atelier Nova"
              className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-body transition-colors focus:border-violet motion-reduce:transition-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-[9px] bg-violet px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-violet-deep motion-reduce:transition-none"
            >
              Rechercher
            </button>
            {search.query && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-[9px] border border-line px-3.5 py-2 text-[12px] font-semibold text-body transition hover:bg-tint-soft motion-reduce:transition-none"
              >
                Effacer
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="px-4 py-3.5 sm:px-5">
        <p
          role={problem ? "alert" : "status"}
          aria-live="polite"
          className={`text-[11.5px] leading-relaxed ${
            problem ? "text-amber" : "text-muted"
          }`}
        >
          {search.message}
        </p>
        {search.state === "ready" && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {search.results.map((prospect) => (
              <li
                key={prospect.id}
                className="min-w-0 rounded-[11px] border border-line-soft bg-tint-soft/35 px-3.5 py-3"
              >
                <p className="break-words text-[12.5px] font-semibold text-ink">
                  {prospect.name}
                </p>
                {prospect.company && (
                  <p className="mt-0.5 break-words text-[11.5px] text-body">
                    {prospect.company}
                  </p>
                )}
                <p className="mt-1.5 break-words text-[10.5px] leading-relaxed text-faint">
                  Source enregistrée : {prospect.source} · synchronisé le {" "}
                  {prospect.syncedAtLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ObservedKpiCard({ kpi }: { kpi: CampaignObservedKpi }) {
  const observation = kpi.observation;
  const availabilityLabel =
    observation.state === "available"
      ? "Observé"
      : observation.state === "insufficient"
        ? "Insuffisant"
        : "Indisponible";
  const availabilityClass =
    observation.state === "available"
      ? "bg-green-tint text-green"
      : observation.state === "insufficient"
        ? "bg-amber-tint text-amber"
        : "bg-tint-soft text-muted";
  return (
    <article className="rounded-[13px] border border-line-soft bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
          {kpi.label}
        </h4>
        <span
          className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.04em] ${availabilityClass}`}
        >
          {availabilityLabel}
        </span>
      </div>
      {observation.state === "available" ? (
        <>
          <p className="mt-2 font-display text-[22px] font-semibold tabular-nums text-ink">
            {observation.value}
          </p>
          {observation.comparison && (
            <p
              className={`mt-0.5 text-[11.5px] font-medium tabular-nums ${toneTextClass(
                observation.comparison.tone,
              )}`}
            >
              {observation.comparison.value}
            </p>
          )}
          <EvidenceReference source={observation.source} className="mt-2" />
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] font-semibold text-body">
            {observation.state === "insufficient"
              ? "Données insuffisantes"
              : "Non disponible"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {observation.reason}
          </p>
          {observation.source && (
            <EvidenceReference source={observation.source} className="mt-2" />
          )}
        </>
      )}
    </article>
  );
}

function DeliveryDiagnosticPanel({
  diagnostic,
}: {
  diagnostic: CampaignDeliveryReading;
}) {
  const available = diagnostic.state === "available";
  return (
    <section
      aria-labelledby="campaign-delivery-diagnostic-title"
      className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
            Comparaison CPM / CTR
          </p>
          <h3
            id="campaign-delivery-diagnostic-title"
            className="mt-1 font-display text-[15px] font-semibold text-ink"
          >
            Lecture descriptive de la livraison
          </h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            available
              ? "bg-tint-soft text-body"
              : "bg-amber-tint text-amber"
          }`}
        >
          {available ? "Comparaison disponible" : "Comparaison indisponible"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <p className="text-[12.5px] leading-relaxed text-body">
            {diagnostic.summary}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            {diagnostic.disclaimer}
          </p>
        </div>
        <ReadingEvidence reading={diagnostic} prominent />
      </div>
    </section>
  );
}

function WeeklyInsightsPanel({
  insights,
}: {
  insights: CampaignWeeklyInsights;
}) {
  const [selectedQuestionId, setSelectedQuestionId] =
    useState<CampaignAnalyticQuestionId>("weekly_observed_totals");
  const selectedQuestion = insights.questions.find(
    (question) => question.id === selectedQuestionId,
  ) ?? insights.questions[0];
  const report = insights.report;

  return (
    <section
      aria-labelledby="campaign-weekly-insights-title"
      className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card"
    >
      <div className="border-b border-line-soft px-4 py-4 sm:px-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
          Fenêtres calendaires fixes
        </p>
        <h3
          id="campaign-weekly-insights-title"
          className="mt-1 font-display text-[16px] font-semibold text-ink"
        >
          Rapport hebdomadaire et questions analytiques
        </h3>
        <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-muted">
          Calcul déterministe sur 7 jours comparés aux 7 jours adjacents
          précédents. Les questions sont prédéfinies ; aucun texte libre ni
          appel IA n&apos;est proposé.
        </p>
      </div>

      <div className="grid gap-5 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.8fr)]">
        <div aria-labelledby="campaign-weekly-report-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4
                id="campaign-weekly-report-title"
                className="text-[13px] font-semibold text-ink"
              >
                Rapport 7 jours / 7 jours
              </h4>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-faint">
                Courante : {report.currentPeriodLabel}
                {report.previousPeriodLabel
                  ? ` · précédente : ${report.previousPeriodLabel}`
                  : " · période précédente indisponible"}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                report.state === "available"
                  ? "bg-green-tint text-green"
                  : "bg-amber-tint text-amber"
              }`}
            >
              {report.state === "available" ? "Reproductible" : "Indisponible"}
            </span>
          </div>

          {report.state === "available" ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.metrics.map((metric) => (
                  <article
                    key={metric.id}
                    className="rounded-[11px] border border-line-soft bg-tint-soft/35 px-3.5 py-3"
                  >
                    <h5 className="text-[10px] font-semibold uppercase tracking-[.06em] text-faint">
                      {metric.label}
                    </h5>
                    <dl className="mt-2 space-y-1 text-[11px]">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">7 jours</dt>
                        <dd className="text-right font-semibold tabular-nums text-ink">
                          {metric.current}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">7 jours précédents</dt>
                        <dd className="text-right tabular-nums text-body">
                          {metric.previous}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-t border-line-soft pt-1">
                        <dt className="text-muted">Variation</dt>
                        <dd className="text-right tabular-nums text-body">
                          {metric.change}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              {report.coverage && (
                <p className="mt-3 text-[11px] leading-relaxed text-body">
                  {report.coverage}
                </p>
              )}
            </>
          ) : (
            <div
              role="status"
              className="mt-3 rounded-[11px] border border-amber/20 bg-amber-tint px-3.5 py-3"
            >
              <p className="text-[11.5px] font-semibold text-amber">
                Rapport indisponible
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-body">
                {report.reason}
              </p>
            </div>
          )}
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
            {report.sourceDetail}
          </p>
          {report.source && (
            <EvidenceReference source={report.source} className="mt-1" />
          )}
        </div>

        <div className="border-t border-line-soft pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <h4 className="text-[13px] font-semibold text-ink">
            Questions disponibles
          </h4>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
            Choisissez une question fixe. La réponse relit le même snapshot.
          </p>
          <div
            aria-label="Questions analytiques prédéfinies"
            className="mt-3 grid gap-2"
          >
            {insights.questions.map((question) => {
              const selected = question.id === selectedQuestion?.id;
              return (
                <button
                  key={question.id}
                  type="button"
                  aria-pressed={selected}
                  aria-controls="campaign-analytic-answer"
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`rounded-[10px] border px-3 py-2 text-left text-[11.5px] font-medium leading-relaxed transition motion-reduce:transition-none ${
                    selected
                      ? "border-violet bg-tint text-violet"
                      : "border-line-soft bg-white text-body hover:bg-tint-soft"
                  }`}
                >
                  {question.label}
                </button>
              );
            })}
          </div>

          {selectedQuestion && (
            <div
              id="campaign-analytic-answer"
              role="status"
              aria-live="polite"
              className={`mt-3 rounded-[11px] border px-3.5 py-3 ${
                selectedQuestion.answer.state === "available"
                  ? "border-line-soft bg-tint-soft/40"
                  : "border-amber/20 bg-amber-tint"
              }`}
            >
              <p className="text-[11.5px] font-semibold leading-relaxed text-ink">
                {selectedQuestion.answer.summary}
              </p>
              {selectedQuestion.answer.details.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[10.5px] leading-relaxed text-body">
                  {selectedQuestion.answer.details.map((detail, index) => (
                    <li key={`${selectedQuestion.id}:${index}`}>{detail}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                {selectedQuestion.answer.periodLabel}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                {selectedQuestion.answer.sourceDetail}
              </p>
              {selectedQuestion.answer.source && (
                <EvidenceReference
                  source={selectedQuestion.answer.source}
                  className="mt-1"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CreativeAuditUnavailable() {
  return (
    <section
      aria-labelledby="campaign-creative-audit-title"
      className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            id="campaign-creative-audit-title"
            className="font-display text-[15px] font-semibold text-ink"
          >
            Audit créatif indisponible
          </h3>
          <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-muted">
            Les lectures actuelles ne contiennent aucun identifiant creative,
            ad ou asset, ni métrique frequency. Les métriques agrégées de
            campagne ne constituent donc pas un audit de créatifs et aucune
            conclusion sur un contenu n&apos;est formulée.
          </p>
        </div>
        <Link
          href="/contenu"
          className="w-fit flex-none rounded-[9px] border border-line px-3.5 py-2 text-[11.5px] font-semibold text-body transition hover:bg-tint-soft hover:text-ink motion-reduce:transition-none"
        >
          Ouvrir Contenu
        </Link>
      </div>
    </section>
  );
}

function PriorityRecommendation({
  recommendation,
}: {
  recommendation: CampaignPriorityRecommendation | null;
}) {
  return (
    <section
      aria-labelledby="priority-recommendation-title"
      className="rounded-[16px] border border-violet/20 bg-tint p-4 sm:p-5"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
        Arbitrage prioritaire
      </p>
      {recommendation ? (
        <div className="mt-1.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div>
            <h3
              id="priority-recommendation-title"
              className="font-display text-[16px] font-semibold text-ink"
            >
              {recommendation.title}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-body">
              {recommendation.summary}
            </p>
          </div>
          <ReadingEvidence reading={recommendation} prominent />
        </div>
      ) : (
        <div className="mt-1.5">
          <h3
            id="priority-recommendation-title"
            className="font-display text-[15px] font-semibold text-ink"
          >
            Aucune recommandation étayée
          </h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-body">
            Le cockpit n&apos;affiche pas de priorité tant qu&apos;une source et
            un niveau de confiance explicites ne sont pas disponibles.
          </p>
        </div>
      )}
    </section>
  );
}

function CampaignTable({ campaigns }: { campaigns: CampaignDecisionRow[] }) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[1480px] text-[12px]">
        <caption className="sr-only">
          Campagnes filtrées, performance observée, CPM, CTR et lectures
          descriptives
        </caption>
        <thead>
          <tr className="border-b border-line-soft text-left text-[10.5px] uppercase tracking-[.06em] text-faint">
            <th scope="col" className="px-[22px] py-2.5 font-semibold">
              Campagne
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              État
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Dépense
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Coût / conversion
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Résultats
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Revenu
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              ROAS
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              CPM
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              CTR
            </th>
            <th scope="col" className="px-[22px] py-2.5 font-semibold">
              Lectures descriptives
            </th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.id}
              className="border-b border-line-soft align-top last:border-b-0"
            >
              <th
                scope="row"
                className="px-[22px] py-3 text-left font-normal"
              >
                <p className="font-semibold text-ink">{campaign.name}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {campaign.channel.label}
                </p>
                {campaign.source ? (
                  <EvidenceReference source={campaign.source} className="mt-1" />
                ) : (
                  <p className="mt-1 text-[10px] text-red">
                    Source de mesure non disponible
                  </p>
                )}
              </th>
              <td className="px-3 py-3">
                <StatusBadge status={campaign.status} />
                <StatusEvidence evidence={campaign.status.evidence} />
              </td>
              <MetricTableCell metric={campaign.spend} />
              <MetricTableCell metric={campaign.acquisitionCost} />
              <MetricTableCell metric={campaign.results} />
              <MetricTableCell metric={campaign.revenue} />
              <MetricTableCell metric={campaign.roas} emphasize />
              <MetricTableCell metric={campaign.cpm} />
              <MetricTableCell metric={campaign.ctr} />
              <td className="max-w-[360px] px-[22px] py-3">
                <CampaignReadings campaign={campaign} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignCards({ campaigns }: { campaigns: CampaignDecisionRow[] }) {
  return (
    <ul className="divide-y divide-line-soft xl:hidden">
      {campaigns.map((campaign) => (
        <li key={campaign.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-[13.5px] font-semibold text-ink">
                {campaign.name}
              </h4>
              <p className="mt-0.5 text-[11px] text-muted">
                {campaign.channel.label}
              </p>
            </div>
            <StatusBadge status={campaign.status} />
          </div>
          <StatusEvidence evidence={campaign.status.evidence} />

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {[
              campaign.spend,
              campaign.acquisitionCost,
              campaign.results,
              campaign.revenue,
              campaign.roas,
              campaign.cpm,
              campaign.ctr,
            ].map((metric) => (
              <MetricDefinition key={metric.label} metric={metric} />
            ))}
          </dl>

          <div className="mt-3 rounded-[10px] bg-tint-soft px-3 py-2.5">
            <CampaignReadings campaign={campaign} />
          </div>

          {campaign.source ? (
            <EvidenceReference source={campaign.source} className="mt-2" />
          ) : (
            <p className="mt-2 text-[10px] text-red">
              Source de mesure non disponible
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function CampaignReadings({ campaign }: { campaign: CampaignDecisionRow }) {
  const deliveryAvailable = campaign.deliveryDiagnostic.state === "available";
  return (
    <div
      role="group"
      aria-label={`Lectures descriptives pour ${campaign.name}`}
      className="space-y-3"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-faint">
          Performance observée
        </p>
        {campaign.agentReading ? (
          <>
            <p className="mt-1 text-[11.5px] leading-relaxed text-body">
              {campaign.agentReading.summary}
            </p>
            <ReadingEvidence reading={campaign.agentReading} />
          </>
        ) : (
          <p className="mt-1 text-[11px] text-muted">
            Aucune lecture de performance étayée.
          </p>
        )}
      </div>

      <div className="border-t border-line-soft pt-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-faint">
            Livraison CPM / CTR
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
              deliveryAvailable
                ? "bg-white text-body"
                : "bg-amber-tint text-amber"
            }`}
          >
            {deliveryAvailable ? "Disponible" : "Indisponible"}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-body">
          {campaign.deliveryDiagnostic.summary}
        </p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
          {campaign.deliveryDiagnostic.disclaimer}
        </p>
        <ReadingEvidence reading={campaign.deliveryDiagnostic} />
      </div>
    </div>
  );
}

function MetricTableCell({
  metric,
  emphasize = false,
}: {
  metric: CampaignMetricCell;
  emphasize?: boolean;
}) {
  const observation = metric.observation;
  return (
    <td className="px-3 py-3 text-right">
      {observation.state === "available" ? (
        <>
          <p
            className={`tabular-nums ${
              emphasize ? "font-semibold text-ink" : "text-body"
            }`}
          >
            {observation.value}
          </p>
          {observation.comparison && (
            <p
              className={`mt-0.5 text-[9.5px] font-medium tabular-nums ${toneTextClass(
                observation.comparison.tone,
              )}`}
            >
              {observation.comparison.value}
            </p>
          )}
          <p className="mt-0.5 text-[9.5px] text-faint">{metric.label}</p>
          <EvidenceReference
            source={observation.source}
            className="mt-0.5 text-right"
          />
        </>
      ) : (
        <div className="ml-auto max-w-[180px]">
          <p className="text-[10.5px] font-medium text-muted">
            {observation.state === "insufficient"
              ? "Insuffisant"
              : "Indisponible"}
          </p>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-faint">
            {observation.reason}
          </p>
          {observation.source && (
            <EvidenceReference
              source={observation.source}
              className="mt-0.5 text-right"
            />
          )}
        </div>
      )}
    </td>
  );
}

function MetricDefinition({ metric }: { metric: CampaignMetricCell }) {
  const observation = metric.observation;
  return (
    <div>
      <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">
        {metric.label}
      </dt>
      <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-body">
        {observation.state === "available"
          ? observation.value
          : observation.state === "insufficient"
            ? "Insuffisant"
            : "Indisponible"}
      </dd>
      {observation.state === "available" && (
        <>
          {observation.comparison && (
            <p
              className={`mt-0.5 text-[9.5px] font-medium tabular-nums ${toneTextClass(
                observation.comparison.tone,
              )}`}
            >
              {observation.comparison.value}
            </p>
          )}
          <EvidenceReference source={observation.source} className="mt-0.5" />
        </>
      )}
      {observation.state !== "available" && (
        <>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">
            {observation.reason}
          </p>
          {observation.source && (
            <EvidenceReference source={observation.source} className="mt-0.5" />
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignDecisionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${toneBadgeClass(
        status.tone,
      )}`}
    >
      {status.label}
    </span>
  );
}

function StatusEvidence({ evidence }: { evidence: CampaignStatusEvidence }) {
  return evidence.kind === "observed" ? (
    <EvidenceReference source={evidence.source} className="mt-1.5" prefix="État" />
  ) : (
    <div className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
      <p>État dérivé · {evidence.rule}</p>
      {evidence.source && <EvidenceReference source={evidence.source} />}
    </div>
  );
}

function ReadingEvidence({
  reading,
  prominent = false,
}: {
  reading: CampaignAgentReading;
  prominent?: boolean;
}) {
  const confidence = reading.confidence;
  return (
    <div
      className={
        prominent
          ? "rounded-[11px] border border-violet/15 bg-white/70 px-3 py-2.5"
          : "mt-2"
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
            confidence.state === "calculated"
              ? confidenceBadgeClass(confidence.level)
              : "bg-tint-soft text-muted"
          }`}
        >
          {confidence.state === "calculated"
            ? `Confiance ${confidenceLabel(confidence.level)}`
            : "Confiance non calculée"}
        </span>
        {!reading.source && (
          <span className="rounded-full bg-red-tint px-2 py-0.5 text-[9.5px] font-semibold text-red">
            Source manquante
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">
        {confidence.reason}
      </p>
      {reading.source ? (
        <EvidenceReference source={reading.source} className="mt-1" />
      ) : (
        <p className="mt-1 text-[10px] leading-relaxed text-red">
          Cette lecture ne doit pas être utilisée comme preuve.
        </p>
      )}
    </div>
  );
}

function EvidenceReference({
  source,
  className = "",
  prefix = "Source",
}: {
  source: CampaignEvidenceReference;
  className?: string;
  prefix?: string;
}) {
  return (
    <p className={`text-[9.5px] leading-relaxed text-faint ${className}`}>
      {prefix} : {source.label}
      {source.periodLabel ? ` · ${source.periodLabel}` : ""}
      {source.observedAtLabel ? ` · relevé ${source.observedAtLabel}` : ""}
    </p>
  );
}

function InlineEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-[11px] border border-dashed border-line bg-tint-soft/50 px-4 py-5 text-center text-[11.5px] leading-relaxed text-muted"
    >
      {children}
    </div>
  );
}

function uniqueOptions(options: Array<{ id: string; label: string }>) {
  return Array.from(
    new Map(options.map((option) => [option.id, option])).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

function confidenceLabel(level: "high" | "medium" | "low") {
  if (level === "high") return "élevée";
  if (level === "medium") return "moyenne";
  return "faible";
}

function confidenceBadgeClass(level: "high" | "medium" | "low") {
  if (level === "high") return "bg-green-tint text-green";
  if (level === "medium") return "bg-amber-tint text-amber";
  return "bg-red-tint text-red";
}

function toneBadgeClass(tone: CampaignTone) {
  if (tone === "positive") return "bg-green-tint text-green";
  if (tone === "warning") return "bg-amber-tint text-amber";
  if (tone === "negative") return "bg-red-tint text-red";
  return "bg-tint-soft text-body";
}

function toneTextClass(tone: CampaignTone | undefined) {
  if (tone === "positive") return "text-green";
  if (tone === "warning") return "text-amber";
  if (tone === "negative") return "text-red";
  return "text-muted";
}
