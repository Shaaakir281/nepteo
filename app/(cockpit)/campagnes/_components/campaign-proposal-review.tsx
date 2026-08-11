"use client";

import { metricLabel, metricUnit, type CampaignBrief, type CampaignPlan } from "@/lib/campaign-plan";
import type { CampaignExpectedFormat, CampaignStudioDraft } from "@/lib/campaign-studio";
import type { CampaignEvidence, CampaignProjectionResult } from "@/lib/campaign-evidence";
import type { CampaignGenerationTrace } from "@/lib/campaign";
import { CampaignAdSetEditor, CompactAdSetList } from "./campaign-proposal-adsets";
import { CampaignHookEditor, SelectedHook } from "./campaign-proposal-hooks";
import { CampaignProposalEvidence } from "./campaign-proposal-evidence";

const ESTIMATION_HELP =
  "La preuve historique exige 7 jours distincts, une dépense positive et 10 conversions. Aucun benchmark de canal ne remplit ce vide.";

export function CampaignProposalReview({
  brief,
  plan,
  evidence,
  projection,
  studio,
  expectedFormats,
  generation,
  demo,
  onStudioChange,
  onResearchBusyChange,
}: {
  brief: CampaignBrief;
  plan: CampaignPlan;
  evidence: CampaignEvidence;
  projection: CampaignProjectionResult;
  studio: CampaignStudioDraft;
  expectedFormats: CampaignExpectedFormat[];
  generation: CampaignGenerationTrace;
  demo: boolean;
  onStudioChange: (studio: CampaignStudioDraft) => void;
  onResearchBusyChange: (busy: boolean) => void;
}) {
  const selectedIndex = studio.selectedHookIndices[0];
  const selectedHook = selectedIndex == null ? "" : studio.hooks[selectedIndex] ?? "";
  const resultPhrase = projection.status === "available"
    ? `${projection.projection.volume.low}–${projection.projection.volume.high} conversions en ${plan.durationDays} jours, ${plan.totalBudget} € au total.`
    : `${metricLabel(brief.primaryMetric)} : seuil ${brief.successThreshold} ${metricUnit(brief.primaryMetric)} en ${plan.durationDays} jours, ${plan.totalBudget} € au total.`;

  return (
    <div className="space-y-4">
      {demo && (
        <p className="rounded-[10px] bg-amber-tint px-3 py-2.5 text-[12px] leading-relaxed text-body">
          Scénario d&apos;exemple : aucune preuve terrain ni recherche payante.
        </p>
      )}

      <div>
        <h4 className="font-display text-[20px] font-medium leading-tight text-ink">
          {resultPhrase}
        </h4>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Pari : {brief.hypothesis}{" "}
          {projection.status !== "available" && (
            <span className="ml-1 inline-flex rounded-full bg-amber-tint px-2 py-1 text-[10.5px] font-semibold text-body">
              Estimation indisponible
              <span tabIndex={0} title={ESTIMATION_HELP} aria-label={ESTIMATION_HELP} className="ml-1 cursor-help underline decoration-dotted">(?)</span>
            </span>
          )}
        </p>
      </div>

      <CompactAdSetList studio={studio} plan={plan} />
      <SelectedHook hook={selectedHook} index={selectedIndex} />

      <details className="rounded-[11px] border border-line-soft px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">
          Ajuster la proposition <span className="ml-1 text-[10.5px] font-medium text-faint">adsets et accroches</span>
        </summary>
        <div className="mt-4 space-y-5 border-t border-line-soft pt-4">
          <CampaignAdSetEditor brief={brief} plan={plan} studio={studio} onChange={onStudioChange} />
          <CampaignHookEditor studio={studio} onChange={onStudioChange} />
        </div>
      </details>

      <details className="rounded-[11px] border border-line-soft px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">
          Preuves et limites <span className="ml-1 text-[10.5px] font-medium text-faint">budget, formats, conditions</span>
        </summary>
        <CampaignProposalEvidence brief={brief} plan={plan} evidence={evidence} projection={projection} expectedFormats={expectedFormats} generation={generation} demo={demo} onResearchBusyChange={onResearchBusyChange} />
      </details>
    </div>
  );
}
