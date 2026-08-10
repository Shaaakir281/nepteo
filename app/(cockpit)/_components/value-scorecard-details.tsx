import type { ValueScorecard as ValueScorecardData } from "@/lib/value-scorecard-rules";
import {
  formatRate,
  GateLine,
  Metric,
  OutcomeMetric,
} from "./value-scorecard-metrics";

const SIGNAL_LABELS: Record<ValueScorecardData["metricSignal"], string> = {
  insufficient_data: "Échantillon à compléter",
  accelerate: "Signal local : accélérer",
  iterate: "Signal local : itérer",
  pivot: "Signal local : pivoter",
};

export function ValueScorecardDetails({
  scorecard,
}: {
  scorecard: ValueScorecardData;
}) {
  const unlinkedCount =
    scorecard.unlinked.recommendationEvents +
    scorecard.unlinked.draftEvents +
    scorecard.unlinked.outcomeEvents;

  return (
    <div className="border-t border-line-soft px-4 pb-4 pt-3">
      <p className="text-[11px] leading-relaxed text-muted">
        Les chiffres « déclaré » viennent des saisies des testeurs. Ils ne
        prouvent ni un envoi ni un résultat observé par un fournisseur. Quand
        un connecteur confirme un fait, il apparaît séparément comme
        « observé fournisseur ».
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Faux positifs" value={formatRate(scorecard.recommendations.falsePositiveRate)} detail="Sur les recommandations examinées" />
        <Metric label="Pas utiles" value={formatRate(scorecard.recommendations.notUsefulRate)} detail="Sur les recommandations examinées" />
        <Metric label="Rejets : contexte manquant" value={formatRate(scorecard.recommendations.missingContextRate)} detail="Sur les verdicts rejetés" />
        <Metric label="Brouillons examinés" value={scorecard.drafts.examined} />
        <Metric label="Sans / peu de retouches" value={formatRate(scorecard.drafts.noneOrLightRate)} />
        <Metric label="Relances manuelles déclarées" value={scorecard.outcomes.manualFollowupsDeclared} />
        <OutcomeMetric label="Rendez-vous" counts={scorecard.outcomes.meetings} />
        <OutcomeMetric label="Opportunités" counts={scorecard.outcomes.opportunities} />
        <Metric label="Évaluateurs locaux" value={scorecard.testers} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[13px] border border-line-soft bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[13.5px] font-semibold text-ink">Objectifs mesurables</h3>
            <span className="text-[11px] font-semibold text-violet">{SIGNAL_LABELS[scorecard.metricSignal]}</span>
          </div>
          <ul className="mt-1">
            <GateLine label="Volume dans cette organisation" current={`${scorecard.recommendations.examined} recommandation(s)`} target="30 recommandations locales" met={scorecard.gates.localRecommendationVolume} />
            <GateLine label="Volume longitudinal" current={`${scorecard.recommendations.examined} recommandation(s)`} target="50 recommandations" met={scorecard.gates.longitudinalVolume} />
            <GateLine label="Utilité" current={formatRate(scorecard.recommendations.usefulRate)} target="≥ 60 %" met={scorecard.gates.utilityTarget} />
            <GateLine label="Faux positifs" current={formatRate(scorecard.recommendations.falsePositiveRate)} target="< 15 %" met={scorecard.gates.falsePositiveTarget} />
            <GateLine label="Brouillons sans / peu de retouches" current={formatRate(scorecard.drafts.noneOrLightRate)} target="≥ 60 %" met={scorecard.gates.draftTarget} />
            <GateLine label="Contexte d'interaction manquant" current={formatRate(scorecard.recommendations.missingContextRate)} target="≥ 30 % des rejets" met={scorecard.gates.missingContextSignal} />
          </ul>
        </div>

        <div className="rounded-[13px] border border-line-soft bg-white px-4 py-3">
          <h3 className="font-display text-[13.5px] font-semibold text-ink">Métriques disponibles avant C7</h3>
          <ul className="mt-1">
            <GateLine label="Relances manuelles déclarées" current={String(scorecard.outcomes.manualFollowupsDeclared)} target="≥ 20" met={scorecard.gates.manualFollowupsTarget} />
            <GateLine label="Signal aval déclaré ou observé" current={`${scorecard.outcomes.downstreamSignals} signal(aux) distinct(s)`} target="≥ 1" met={scorecard.gates.downstreamSignal} />
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Ces métriques ne déclenchent rien automatiquement. Une organisation
            ne voit que ses preuves ; le gate programme « 3 testeurs » et la
            décision globale exigent une consolidation anonymisée hors de cette page.
          </p>
        </div>
      </div>

      {unlinkedCount > 0 && <p className="mt-3 text-[11px] text-muted" role="status">{unlinkedCount} événement(s) historique(s) non rattaché(s), jamais fusionné(s).</p>}
      {scorecard.excludedDemoEvents > 0 && <p className="mt-1 text-[11px] text-faint">{scorecard.excludedDemoEvents} événement(s) de démonstration exclu(s) des calculs.</p>}
    </div>
  );
}
