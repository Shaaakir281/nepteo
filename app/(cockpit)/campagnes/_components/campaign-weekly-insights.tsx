"use client";

import { useState } from "react";
import type { CampaignAnalyticQuestionId } from "@/lib/campaign-insights";
import type { CampaignWeeklyInsights } from "./campaign-decision-types";
import { EvidenceReference } from "./campaign-evidence";

export function WeeklyInsightsPanel({
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

        {report.state === "available" && (
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
        )}
      </div>
    </section>
  );
}
