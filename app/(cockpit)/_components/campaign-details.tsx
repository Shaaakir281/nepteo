import { ValidationSection } from "./validation-section";
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

/** Détails d'une proposition de campagne (budget, messages, garde-fous). */
export function CampaignDetails({
  payload,
}: {
  payload?: Record<string, unknown> | null;
}) {
  const p = (payload ?? {}) as {
    brief?: CampaignBrief;
    plan?: CampaignPlan;
    projection?: CampaignProjectionResult;
    variants?: string[];
  };
  const brief = p.brief;
  const plan = p.plan;
  const projection =
    p.projection?.status === "available" ? p.projection.projection : null;
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (!plan) return null;

  return (
    <>
      <ValidationSection label="La campagne" />
      <div className="grid grid-cols-3 gap-2">
        <MiniStat l="Budget" v={`${plan.totalBudget ?? "—"} €`} />
        <MiniStat l="Durée" v={`${plan.durationDays ?? "—"} j`} />
        <MiniStat
          l="Coût / conversion"
          v={projection ? `${projection.costPerContact.low}–${projection.costPerContact.high} €` : "Données insuffisantes"}
        />
      </div>
      {projection && (
        <p className="mt-2 text-[12.5px] text-body">
          Ordre de grandeur estimé sur les faits observés :{" "}
          <b className="text-ink">
            {projection.volume.low}–{projection.volume.high} conversions
          </b>
          {" · "}ROAS {projection.roas.low}–{projection.roas.high}. Ce n&apos;est pas
          une garantie.
        </p>
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
              label="Succès"
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
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-3 py-2 text-[12.5px] leading-relaxed text-body"
              >
                <b className="text-ink">{String.fromCharCode(65 + i)} · </b>
                {v}
              </div>
            ))}
          </div>
        </>
      )}

      <ValidationSection label="Limites de la proposition" />
      <ul className="space-y-1 text-[12.5px] text-body">
        <li>• Plafond du plan : {plan.dailyCap ?? "—"} € / jour.</li>
        <li>
          • Seuil de lecture : {plan.stopCostPerContact ?? "—"} € / conversion.
        </li>
        <li>
          • CAMP-1 conserve une proposition non exécutable : validation ≠ lancement.
        </li>
      </ul>
    </>
  );
}

function BriefLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold text-ink">{label} : </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}

function MiniStat({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">
        {l}
      </p>
      <p className="mt-0.5 font-display text-[14px] font-semibold text-ink">
        {v}
      </p>
    </div>
  );
}
