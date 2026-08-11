"use client";

import {
  CAMPAIGN_BUDGET_LIMITS,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_DURATIONS,
  CAMPAIGN_METRICS,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_TEXT_LIMITS,
  CAMPAIGN_TYPES,
  metricUnit,
  type CampaignValidationErrors,
} from "@/lib/campaign-plan";
import type { CampaignBriefDefaults } from "@/lib/campaign-brief-defaults";
import {
  ChoiceField,
  FieldError,
  NumberField,
  TextField,
} from "./campaign-brief-fields";

export type CampaignBriefDraft = CampaignBriefDefaults;

export const EMPTY_CAMPAIGN_BRIEF: CampaignBriefDraft = {
  objective: "",
  campaignType: "",
  audience: "",
  offer: "",
  hypothesis: "",
  channel: "",
  dailyBudget: "",
  durationDays: "",
  primaryMetric: "",
  successThreshold: "",
  context: "",
};

export function campaignBriefInput(draft: CampaignBriefDraft) {
  return {
    ...draft,
    dailyBudget: draft.dailyBudget === "" ? null : Number(draft.dailyBudget),
    durationDays: draft.durationDays === "" ? null : Number(draft.durationDays),
    successThreshold:
      draft.successThreshold === "" ? null : Number(draft.successThreshold),
  };
}

export function CampaignBriefForm({
  draft,
  errors,
  idPrefix,
  onChange,
}: {
  draft: CampaignBriefDraft;
  errors: CampaignValidationErrors;
  idPrefix: string;
  onChange: (patch: Partial<CampaignBriefDraft>) => void;
}) {
  const unit = metricUnit(draft.primaryMetric);
  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-muted">
        Prérempli depuis votre fiche entreprise — corrigez ce qui ne va pas.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label="Objectif"
          options={CAMPAIGN_OBJECTIVES}
          value={draft.objective}
          error={errors.objective}
          onPick={(objective) => onChange({ objective })}
        />
        <NumberField
          id={`${idPrefix}-budget`}
          label="Budget par jour (€)"
          value={draft.dailyBudget}
          error={errors.dailyBudget}
          min={CAMPAIGN_BUDGET_LIMITS.min}
          max={CAMPAIGN_BUDGET_LIMITS.max}
          step="0.01"
          placeholder={`${CAMPAIGN_BUDGET_LIMITS.min} à ${CAMPAIGN_BUDGET_LIMITS.max}`}
          onChange={(dailyBudget) => onChange({ dailyBudget })}
        />
      </div>
      <TextField
        id={`${idPrefix}-audience`}
        label="Audience"
        value={draft.audience}
        error={errors.audience}
        maxLength={CAMPAIGN_TEXT_LIMITS.audience.max}
        placeholder="Ex. dirigeants de PME industrielles en France"
        onChange={(audience) => onChange({ audience })}
      />
      <TextField
        id={`${idPrefix}-offer`}
        label="Offre"
        value={draft.offer}
        error={errors.offer}
        maxLength={CAMPAIGN_TEXT_LIMITS.offer.max}
        placeholder="Ex. audit de positionnement à 2 400 €"
        onChange={(offer) => onChange({ offer })}
      />

      <details className="rounded-[11px] border border-line-soft bg-tint-soft/35 px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">
          Affiner <span className="ml-1 text-[10.5px] font-medium text-faint">7 réglages</span>
        </summary>
        <div className="mt-4 space-y-4 border-t border-line-soft pt-4">
          <ChoiceField
            label="Type de campagne"
            options={CAMPAIGN_TYPES}
            value={draft.campaignType}
            error={errors.campaignType}
            onPick={(campaignType) => onChange({ campaignType })}
          />
          <TextField
            id={`${idPrefix}-hypothesis`}
            label="Hypothèse à tester"
            value={draft.hypothesis}
            error={errors.hypothesis}
            maxLength={CAMPAIGN_TEXT_LIMITS.hypothesis.max}
            placeholder="Ex. une preuve client concrète augmentera les demandes"
            onChange={(hypothesis) => onChange({ hypothesis })}
          />
          <ChoiceField label="Canal" options={CAMPAIGN_CHANNELS} value={draft.channel} error={errors.channel} onPick={(channel) => onChange({ channel })} />
          <ChoiceField label="Durée" options={CAMPAIGN_DURATIONS.map((days) => ({ value: String(days), label: `${days} jours` }))} value={draft.durationDays} error={errors.durationDays} onPick={(durationDays) => onChange({ durationDays })} />
          <ChoiceField label="Métrique principale" options={CAMPAIGN_METRICS} value={draft.primaryMetric} error={errors.primaryMetric} onPick={(primaryMetric) => onChange({ primaryMetric })} />
          <NumberField id={`${idPrefix}-threshold`} label={`Seuil de succès${unit ? ` (${unit})` : ""}`} value={draft.successThreshold} error={errors.successThreshold} min={0.1} max={100_000} step="0.01" placeholder="Seuil à atteindre" onChange={(successThreshold) => onChange({ successThreshold })} />
          <label className="block" htmlFor={`${idPrefix}-context`}>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">Contexte facultatif</span>
            <textarea id={`${idPrefix}-context`} value={draft.context} maxLength={CAMPAIGN_TEXT_LIMITS.context.max} rows={3} placeholder="Contraintes, ton ou élément à reprendre." onChange={(event) => onChange({ context: event.target.value })} className="w-full resize-y rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
            <FieldError message={errors.context} />
          </label>
        </div>
      </details>

      <p className="text-[11px] leading-relaxed text-faint">
        Rien n&apos;est lancé à cette étape. Le serveur revalide le brief et
        redérive le budget total avant l&apos;ajout à la file.
      </p>
    </div>
  );
}
