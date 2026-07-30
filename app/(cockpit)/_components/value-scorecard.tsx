import type {
  OutcomeSourceCounts,
  ValueRate,
  ValueScorecard as ValueScorecardData,
} from "@/lib/value-scorecard-rules";

function formatRate(value: ValueRate): string {
  if (value.percentage === null) return `— (${value.numerator}/${value.denominator})`;
  return `${value.percentage.toLocaleString("fr-FR")} % (${value.numerator}/${value.denominator})`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[11px] border border-line-soft bg-white px-3.5 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-[19px] font-semibold text-ink">
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          {detail}
        </p>
      )}
    </div>
  );
}

function GateLine({
  label,
  current,
  target,
  met,
}: {
  label: string;
  current: string;
  target: string;
  met: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-line-soft py-2.5 first:border-t-0">
      <div>
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {current} · objectif {target}
        </p>
      </div>
      <span
        className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
          met ? "bg-green-tint text-green" : "bg-tint text-violet"
        }`}
      >
        {met ? "Atteint" : "À poursuivre"}
      </span>
    </li>
  );
}

function OutcomeMetric({
  label,
  counts,
}: {
  label: string;
  counts: OutcomeSourceCounts;
}) {
  const detail =
    counts.observed > 0
      ? `${counts.declared} déclaré(s) · ${counts.observed} observé(s) fournisseur`
      : `${counts.declared} déclaré(s) · aucun fait fournisseur observé`;

  return <Metric label={label} value={counts.total} detail={detail} />;
}

const SIGNAL_LABELS: Record<ValueScorecardData["metricSignal"], string> = {
  insufficient_data: "Échantillon à compléter",
  accelerate: "Signal local : accélérer",
  iterate: "Signal local : itérer",
  pivot: "Signal local : pivoter",
};

/**
 * Scorecard de preuve terrain. Le composant est volontairement présentatif :
 * la page appelante lit value_events puis passe buildValueScorecard(rows).
 */
export function ValueScorecard({
  scorecard,
}: {
  scorecard: ValueScorecardData;
}) {
  const unlinkedCount =
    scorecard.unlinked.recommendationEvents +
    scorecard.unlinked.draftEvents +
    scorecard.unlinked.outcomeEvents;

  return (
    <section
      aria-labelledby="value-scorecard-title"
      className="rounded-[18px] border border-line-soft bg-tint-soft/40 p-5 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
            Pilote prospects dormants
          </p>
          <h2
            id="value-scorecard-title"
            className="mt-1 font-display text-[16px] font-semibold text-ink"
          >
            Preuve terrain déclarée
          </h2>
        </div>
        <span className="rounded-full bg-tint px-3 py-1 text-[11px] font-semibold text-violet">
          {scorecard.testers} évaluateur{scorecard.testers > 1 ? "s" : ""} local
        </span>
      </div>

      <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-muted">
        Les chiffres « déclaré » viennent des saisies des testeurs. Ils ne
        prouvent ni un envoi ni un résultat observé par un fournisseur. Quand
        un connecteur confirme un fait, il apparaît séparément comme
        « observé fournisseur ».
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Recommandations examinées"
          value={scorecard.recommendations.examined}
          detail="Dernier verdict par action"
        />
        <Metric
          label="Utiles"
          value={formatRate(scorecard.recommendations.usefulRate)}
          detail="Numérateur / recommandations examinées"
        />
        <Metric
          label="Faux positifs"
          value={formatRate(scorecard.recommendations.falsePositiveRate)}
          detail="Numérateur / recommandations examinées"
        />
        <Metric
          label="Pas utiles"
          value={formatRate(scorecard.recommendations.notUsefulRate)}
          detail="Numérateur / recommandations examinées"
        />
        <Metric
          label="Rejets : contexte manquant"
          value={formatRate(scorecard.recommendations.missingContextRate)}
          detail="Motif contexte manquant / verdicts rejetés"
        />
        <Metric
          label="Brouillons examinés"
          value={scorecard.drafts.examined}
          detail="Dernière revue par action"
        />
        <Metric
          label="Sans / peu de retouches"
          value={formatRate(scorecard.drafts.noneOrLightRate)}
          detail="Numérateur / brouillons examinés"
        />
        <Metric
          label="Relances manuelles déclarées"
          value={scorecard.outcomes.manualFollowupsDeclared}
          detail="Couples action + prospect distincts"
        />
        <OutcomeMetric label="Réponses" counts={scorecard.outcomes.replies} />
        <OutcomeMetric label="Rendez-vous" counts={scorecard.outcomes.meetings} />
        <OutcomeMetric
          label="Opportunités"
          counts={scorecard.outcomes.opportunities}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[13px] border border-line-soft bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[13.5px] font-semibold text-ink">
              Objectifs mesurables
            </h3>
            <span className="text-[11px] font-semibold text-violet">
              {SIGNAL_LABELS[scorecard.metricSignal]}
            </span>
          </div>
          <ul className="mt-1">
            <GateLine
              label="Volume dans cette organisation"
              current={`${scorecard.recommendations.examined} recommandation(s)`}
              target="30 recommandations locales"
              met={scorecard.gates.localRecommendationVolume}
            />
            <GateLine
              label="Volume longitudinal"
              current={`${scorecard.recommendations.examined} recommandation(s)`}
              target="50 recommandations"
              met={scorecard.gates.longitudinalVolume}
            />
            <GateLine
              label="Utilité"
              current={formatRate(scorecard.recommendations.usefulRate)}
              target="≥ 60 %"
              met={scorecard.gates.utilityTarget}
            />
            <GateLine
              label="Faux positifs"
              current={formatRate(scorecard.recommendations.falsePositiveRate)}
              target="< 15 %"
              met={scorecard.gates.falsePositiveTarget}
            />
            <GateLine
              label="Brouillons sans / peu de retouches"
              current={formatRate(scorecard.drafts.noneOrLightRate)}
              target="≥ 60 %"
              met={scorecard.gates.draftTarget}
            />
            <GateLine
              label="Contexte d'interaction manquant"
              current={formatRate(
                scorecard.recommendations.missingContextRate,
              )}
              target="≥ 30 % des rejets (signal de cadrage)"
              met={scorecard.gates.missingContextSignal}
            />
          </ul>
        </div>

        <div className="rounded-[13px] border border-line-soft bg-white px-4 py-3">
          <h3 className="font-display text-[13.5px] font-semibold text-ink">
            Métriques disponibles avant C7
          </h3>
          <ul className="mt-1">
            <GateLine
              label="Relances manuelles déclarées"
              current={String(scorecard.outcomes.manualFollowupsDeclared)}
              target="≥ 20"
              met={scorecard.gates.manualFollowupsTarget}
            />
            <GateLine
              label="Signal aval déclaré ou observé"
              current={`${scorecard.outcomes.downstreamSignals} signal(aux) distinct(s)`}
              target="≥ 1"
              met={scorecard.gates.downstreamSignal}
            />
          </ul>
          <p className="mt-2 rounded-[10px] bg-tint-soft px-3 py-2 text-[11px] leading-relaxed text-muted">
            Ces métriques ne déclenchent rien automatiquement. Les deux semaines
            de test, les incidents, le RGPD, les garde-fous d&apos;envoi et
            l&apos;autorisation explicite restent à vérifier séparément.
            Le signal de contexte exige aussi au moins deux pilotes dans le
            même écosystème ; le temps de recherche reste relevé dans la fiche
            de test.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Une organisation n&apos;affiche que ses propres preuves. Le gate
            programme « 3 testeurs » et la décision globale exigent une
            consolidation anonymisée hors de cette page ; ils ne sont jamais
            déduits d&apos;un total local.
          </p>
        </div>
      </div>

      {unlinkedCount > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted" role="status">
          {unlinkedCount} événement(s) historique(s) sans action ou prospect
          encore rattaché : ils restent distincts et ne sont jamais fusionnés
          sous une identité « inconnue ».
        </p>
      )}
      {scorecard.excludedDemoEvents > 0 && (
        <p className="mt-1 text-[11px] text-faint">
          {scorecard.excludedDemoEvents} événement(s) de démonstration exclu(s)
          de tous les calculs.
        </p>
      )}
    </section>
  );
}
