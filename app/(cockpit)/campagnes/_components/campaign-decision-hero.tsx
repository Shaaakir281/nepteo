import Link from "next/link";
import { analyzeAdsForm } from "../actions";
import type {
  CampaignCockpitDataState,
  CampaignDecisionPeriod,
  CampaignObservedKpi,
  CampaignPriorityRecommendation,
} from "./campaign-decision-types";
import { ReadingEvidence } from "./campaign-evidence";
import { ObservedKpiCard } from "./campaign-kpi-card";

export function CampaignDecisionHero({
  canEdit,
  dataState,
  period,
  kpis,
  recommendation,
  dailySummary,
  hasMeasuredData,
}: {
  canEdit: boolean;
  dataState: CampaignCockpitDataState;
  period: CampaignDecisionPeriod;
  kpis: CampaignObservedKpi[];
  recommendation: CampaignPriorityRecommendation | null;
  dailySummary: string | null;
  hasMeasuredData: boolean;
}) {
  const globallyEmpty = dataState.kind === "empty" && !hasMeasuredData;
  const title = globallyEmpty
    ? "Rien à mesurer pour l’instant."
    : recommendation?.title ?? dailySummary ?? "Aucune recommandation étayée";
  const reason = period.comparisonUnavailableReason
    ? `Comparaison indisponible : ${period.comparisonUnavailableReason}`
    : dataState.kind === "ready"
      ? "Les seuils de preuve exigent sept jours distincts, une dépense positive et dix conversions."
      : dataState.description;

  return (
    <section className="rounded-[18px] border border-line-soft bg-white px-5 py-5 shadow-card sm:px-7 sm:py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {period.startLabel} au {period.endLabel}
        {period.comparison
          ? ` · vs ${period.comparison.startLabel} au ${period.comparison.endLabel}`
          : ""}
      </p>
      <h2 className="mt-2 max-w-[28ch] font-display text-[22px] font-medium leading-tight text-ink sm:text-[24px]">
        {title}
      </h2>

      {!globallyEmpty && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {kpis.slice(0, 3).map((kpi) => (
              <ObservedKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
          {recommendation ? (
            <div className="mt-4 rounded-[11px] bg-tint-soft px-3.5 py-3">
              <p className="text-[12px] leading-relaxed text-body">
                {recommendation.summary}
              </p>
              <ReadingEvidence reading={recommendation} />
            </div>
          ) : (
            <details className="mt-3 text-[11.5px] text-muted">
              <summary className="w-fit cursor-pointer font-semibold text-violet">
                Pourquoi ?
              </summary>
              <p className="mt-1 max-w-2xl leading-relaxed">{reason}</p>
            </details>
          )}
        </>
      )}

      {canEdit && (globallyEmpty || hasMeasuredData) && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {globallyEmpty ? (
            <>
              <Link
                href="/entreprise?onglet=connecteurs"
                className="rounded-[10px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep"
              >
                Brancher un compte publicitaire
              </Link>
              <Link href="/prise-en-main" className="text-[11.5px] font-semibold text-violet">
                ou charger un scénario d&apos;exemple
              </Link>
            </>
          ) : hasMeasuredData ? (
            <form action={analyzeAdsForm}>
              <button
                type="submit"
                className="rounded-[10px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep"
              >
                Analyser
              </button>
            </form>
          ) : null}
        </div>
      )}
    </section>
  );
}
