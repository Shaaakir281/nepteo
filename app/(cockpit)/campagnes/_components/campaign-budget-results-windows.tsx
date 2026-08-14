import type {
  BudgetResultsPeriodMetrics,
  BudgetResultsSnapshot,
  BudgetResultsWindow,
} from "@/lib/budget-results";
import {
  formatAttribution,
  formatMoney,
  formatNumber,
  formatPeriod,
  formatTimestamp,
  ObservationValue,
  TrendValue,
  UNAVAILABLE,
} from "./campaign-budget-results-format";

const COVERAGE_LABELS: Record<BudgetResultsPeriodMetrics["coverage"], string> = {
  complete: "Couverture complète",
  partial: "Couverture partielle",
  missing: "Couverture absente",
};

function ResultSeries({
  period,
  window,
  currency,
}: {
  period: BudgetResultsPeriodMetrics;
  window: BudgetResultsWindow;
  currency: string | null;
}) {
  if (period.resultsState.status === "unavailable") {
    return (
      <div className="rounded-[9px] border border-line-soft px-3 py-2.5">
        <p className="text-[10px] font-semibold text-body">Résultats déclarés par Meta</p>
        <p className="mt-1 text-[11px] text-muted">{UNAVAILABLE}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {period.results.map((result) => {
        const trend = window.trend.results.find(
          (candidate) =>
            candidate.resultType === result.resultType &&
            candidate.attribution.model === result.attribution.model &&
            candidate.attribution.windows.join("\u0000") === result.attribution.windows.join("\u0000"),
        );
        return (
          <article key={`${result.resultType}:${result.attribution.model}:${result.attribution.windows.join(":")}`} className="rounded-[9px] border border-line-soft px-3 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-body">Résultat Meta</p>
                <code className="mt-0.5 block break-all text-[9.5px] text-violet">{result.resultType}</code>
              </div>
              <span className="rounded-full bg-tint px-2 py-0.5 text-[9px] font-semibold text-violet">
                fournisseur
              </span>
            </div>
            <dl className="mt-2 grid gap-2 text-[10.5px] sm:grid-cols-2">
              <div>
                <dt className="text-muted">Résultat déclaré</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">{formatNumber(result.value)}</dd>
              </div>
              <div>
                <dt className="text-muted">Coût par résultat</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  <ObservationValue observation={result.costPerResult} currency={currency} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">Tendance du résultat</dt>
                <dd className="mt-0.5 tabular-nums text-body">
                  {trend
                    ? <TrendValue change={trend.value} format={formatNumber} />
                    : <span className="text-muted">{UNAVAILABLE}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Tendance du coût</dt>
                <dd className="mt-0.5 tabular-nums text-body">
                  {trend
                    ? <TrendValue change={trend.costPerResult} format={(value) => formatMoney(value, currency)} />
                    : <span className="text-muted">{UNAVAILABLE}</span>}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[9.5px] leading-relaxed text-faint">
              Attribution : {formatAttribution(result.attribution)}
            </p>
          </article>
        );
      })}
    </div>
  );
}

export function WindowCard({ window, currency }: { window: BudgetResultsWindow; currency: string | null }) {
  return (
    <article className="rounded-[12px] border border-line-soft bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-[12px] font-semibold text-ink">Fenêtre {window.days} jours</h4>
          <p className="mt-0.5 text-[9.5px] text-faint">{formatPeriod(window.current.period)}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
          window.current.coverage === "complete"
            ? "bg-green-tint text-green"
            : "bg-amber-tint text-amber"
        }`}>
          {COVERAGE_LABELS[window.current.coverage]}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-[9px] bg-tint-soft/45 px-3 py-2.5">
          <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">Dépense réelle</dt>
          <dd className="mt-1 text-[13px] font-semibold tabular-nums text-ink">
            <ObservationValue observation={window.current.spend} currency={currency} />
          </dd>
        </div>
        <div className="rounded-[9px] bg-tint-soft/45 px-3 py-2.5">
          <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">Tendance dépense</dt>
          <dd className="mt-1 text-[10.5px] tabular-nums text-body">
            <TrendValue change={window.trend.spend} format={(value) => formatMoney(value, currency)} />
          </dd>
        </div>
      </dl>
      <div className="mt-2">
        <ResultSeries period={window.current} window={window} currency={currency} />
      </div>
      <p className="mt-2 text-[9.5px] text-faint">
        Comparaison : {formatPeriod(window.previous.period)}
      </p>
    </article>
  );
}

export function CampaignBudgets({
  campaign,
  timezone,
}: {
  campaign: BudgetResultsSnapshot["campaigns"][number];
  timezone: string | null;
}) {
  return (
    <dl className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-[10px] border border-line-soft bg-tint-soft/35 px-3 py-2.5">
        <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">Budget prévu rapproché</dt>
        <dd className="mt-1 text-[11px] font-semibold text-ink">
          {campaign.plannedBudget.status === "available"
            ? formatMoney(campaign.plannedBudget.amount, campaign.plannedBudget.currency)
            : "Budget prévu non rapproché"}
        </dd>
        {campaign.plannedBudget.status === "available" && (
          <p className="mt-1 text-[9.5px] text-muted">{formatPeriod(campaign.plannedBudget.period)}</p>
        )}
      </div>
      <div className="rounded-[10px] border border-line-soft bg-tint-soft/35 px-3 py-2.5">
        <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">Budget fournisseur</dt>
        <dd className="mt-1 text-[11px] font-semibold text-ink">
          {campaign.providerBudget.status === "available"
            ? formatMoney(campaign.providerBudget.amount, campaign.providerBudget.currency)
            : UNAVAILABLE}
        </dd>
        {campaign.providerBudget.status === "available" && (
          <p className="mt-1 text-[9.5px] text-muted">
            {campaign.providerBudget.kind === "daily" ? "Journalier" : "Durée de vie"} · observé {formatTimestamp(campaign.providerBudget.observedAt, timezone ?? "UTC")}
          </p>
        )}
      </div>
      <div className="rounded-[10px] border border-line-soft bg-tint-soft/35 px-3 py-2.5">
        <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">Prévu / dépensé</dt>
        {campaign.plannedVsActual.status === "available" ? (
          <dd className="mt-1 text-[10.5px] leading-relaxed text-body">
            <span className="block font-semibold tabular-nums text-ink">
              {formatMoney(campaign.plannedVsActual.actual, campaign.plannedVsActual.currency)} dépensés
            </span>
            <span className="block tabular-nums">
              {formatMoney(campaign.plannedVsActual.remaining, campaign.plannedVsActual.currency)} restants · {new Intl.NumberFormat("fr-FR", {
                style: "percent",
                maximumFractionDigits: 1,
              }).format(campaign.plannedVsActual.spentRatio)}
            </span>
          </dd>
        ) : (
          <dd className="mt-1 text-[11px] font-semibold text-muted">{UNAVAILABLE}</dd>
        )}
      </div>
    </dl>
  );
}
