import {
  campaignTypeLabel,
  channelLabel,
  metricLabel,
  metricUnit,
  objectiveLabel,
  type CampaignBrief,
  type CampaignPlan,
} from "@/lib/campaign-plan";
import type { CampaignProjectionResult } from "@/lib/campaign-evidence";
import type { CampaignStudioProposal } from "@/lib/campaign-studio";
import { ValidationSection } from "./validation-section";

function BriefLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold text-ink">{label} : </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[14px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export function CampaignProposalDetails({
  payload,
}: {
  payload?: Record<string, unknown> | null;
}) {
  const proposal = (payload ?? {}) as {
    brief?: CampaignBrief;
    plan?: CampaignPlan;
    projection?: CampaignProjectionResult;
    variants?: string[];
    studio?: CampaignStudioProposal;
  };
  const { brief, plan, studio } = proposal;
  const projection =
    proposal.projection?.status === "available"
      ? proposal.projection.projection
      : null;
  const variants = Array.isArray(proposal.variants) ? proposal.variants : [];

  return (
    <>
      {plan && (
        <>
          <ValidationSection label="Proposition de campagne" />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Budget proposé" value={`${plan.totalBudget} €`} />
            <MiniStat label="Durée" value={`${plan.durationDays} j`} />
            <MiniStat
              label="Coût / conversion estimé"
              value={
                projection
                  ? `${projection.costPerContact.low}–${projection.costPerContact.high} €`
                  : "Données insuffisantes"
              }
            />
          </div>
          {projection && (
            <p className="mt-2 text-[12.5px] text-body">
              Estimation : <b className="text-ink">{projection.volume.low}–{projection.volume.high} conversions</b>
              {" · "}ROAS {projection.roas.low}–{projection.roas.high}. Aucune garantie.
            </p>
          )}
        </>
      )}

      {brief && (
        <>
          <ValidationSection label="Brief validé" />
          <dl className="space-y-2 text-[12.5px] leading-relaxed text-body">
            <BriefLine label="Objectif" value={objectiveLabel(brief.objective)} />
            <BriefLine label="Étape" value={campaignTypeLabel(brief.campaignType)} />
            <BriefLine label="Audience" value={brief.audience} />
            <BriefLine label="Offre" value={brief.offer} />
            <BriefLine label="Hypothèse" value={brief.hypothesis} />
            <BriefLine label="Canal" value={channelLabel(brief.channel)} />
            <BriefLine
              label="Succès visé"
              value={`${metricLabel(brief.primaryMetric)} ≥ ${brief.successThreshold} ${metricUnit(brief.primaryMetric)}`}
            />
            {brief.context && <BriefLine label="Contexte" value={brief.context} />}
          </dl>
        </>
      )}

      {variants.length > 0 && (
        <>
          <ValidationSection label="Hooks sélectionnés" />
          <div className="space-y-1.5">
            {variants.map((variant, index) => (
              <div key={`${index}-${variant}`} className="rounded-[10px] border border-line-soft px-3 py-2 text-[12.5px] text-body">
                <b className="text-ink">{String.fromCharCode(65 + index)} · </b>{variant}
              </div>
            ))}
          </div>
        </>
      )}

      {studio && (
        <>
          <ValidationSection label="Structure et allocation" />
          <div className="space-y-2">
            {studio.adSets.map((adSet) => (
              <div key={adSet.id} className="rounded-[10px] border border-line-soft px-3 py-2 text-[12px] text-body">
                <p className="font-semibold text-ink">{adSet.name} · {adSet.allocationPercent} % · {adSet.budget} €</p>
                <p className="mt-0.5">{adSet.audience}</p>
              </div>
            ))}
          </div>
          {studio.expectedFormats.length > 0 && (
            <>
              <ValidationSection label="Formats attendus" />
              <p className="text-[12px] leading-relaxed text-body">
                {studio.expectedFormats.map((format) => format.label).join(" · ")}.
              </p>
            </>
          )}
        </>
      )}

      {plan && (
        <>
          <ValidationSection label="Limites de la proposition" />
          <ul className="space-y-1 text-[12px] text-body">
            <li>• Budget journalier proposé : {plan.dailyCap} €. Aucun contrôle fournisseur actif.</li>
            <li>• Seuil futur à vérifier : {plan.stopCostPerContact} € / conversion.</li>
            <li>• Aucun préflight fournisseur ni lancement dans CAMP-1.</li>
          </ul>
        </>
      )}
    </>
  );
}
