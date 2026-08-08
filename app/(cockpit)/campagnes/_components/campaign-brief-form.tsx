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

export interface CampaignBriefDraft {
  objective: string;
  campaignType: string;
  audience: string;
  offer: string;
  hypothesis: string;
  channel: string;
  dailyBudget: string;
  durationDays: string;
  primaryMetric: string;
  successThreshold: string;
  context: string;
}

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
      <ChoiceField
        label="Objectif"
        options={CAMPAIGN_OBJECTIVES}
        value={draft.objective}
        error={errors.objective}
        onPick={(objective) => onChange({ objective })}
      />
      <ChoiceField
        label="Étape / type de campagne"
        options={CAMPAIGN_TYPES}
        value={draft.campaignType}
        error={errors.campaignType}
        onPick={(campaignType) => onChange({ campaignType })}
      />

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
      <TextField
        id={`${idPrefix}-hypothesis`}
        label="Hypothèse à tester"
        value={draft.hypothesis}
        error={errors.hypothesis}
        maxLength={CAMPAIGN_TEXT_LIMITS.hypothesis.max}
        placeholder="Ex. une preuve client concrète augmentera les demandes de rendez-vous"
        onChange={(hypothesis) => onChange({ hypothesis })}
      />

      <ChoiceField
        label="Canal"
        options={CAMPAIGN_CHANNELS}
        value={draft.channel}
        error={errors.channel}
        onPick={(channel) => onChange({ channel })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-budget`}
          label="Budget journalier (€)"
          value={draft.dailyBudget}
          error={errors.dailyBudget}
          min={CAMPAIGN_BUDGET_LIMITS.min}
          max={CAMPAIGN_BUDGET_LIMITS.max}
          step="0.01"
          placeholder={`${CAMPAIGN_BUDGET_LIMITS.min} à ${CAMPAIGN_BUDGET_LIMITS.max}`}
          onChange={(dailyBudget) => onChange({ dailyBudget })}
        />
        <ChoiceField
          label="Durée finie"
          options={CAMPAIGN_DURATIONS.map((days) => ({
            value: String(days),
            label: `${days} jours`,
          }))}
          value={draft.durationDays}
          error={errors.durationDays}
          onPick={(durationDays) => onChange({ durationDays })}
        />
      </div>

      <ChoiceField
        label="Métrique principale"
        options={CAMPAIGN_METRICS}
        value={draft.primaryMetric}
        error={errors.primaryMetric}
        onPick={(primaryMetric) => onChange({ primaryMetric })}
      />
      <NumberField
        id={`${idPrefix}-threshold`}
        label={`Seuil de succès${unit ? ` (${unit})` : ""}`}
        value={draft.successThreshold}
        error={errors.successThreshold}
        min={0.1}
        max={100_000}
        step="0.01"
        placeholder="Seuil à atteindre"
        onChange={(successThreshold) => onChange({ successThreshold })}
      />

      <label className="block" htmlFor={`${idPrefix}-context`}>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
          Contexte facultatif
        </span>
        <textarea
          id={`${idPrefix}-context`}
          value={draft.context}
          maxLength={CAMPAIGN_TEXT_LIMITS.context.max}
          rows={3}
          placeholder="Contraintes, ton ou élément à reprendre."
          onChange={(event) => onChange({ context: event.target.value })}
          className="w-full resize-y rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
        />
        <FieldError message={errors.context} />
      </label>

      <p className="text-[12px] leading-relaxed text-muted">
        Aucun choix n&apos;est pris à votre place. Le budget total sera recalculé
        côté serveur avant l&apos;ajout à la file.
      </p>
    </div>
  );
}

function ChoiceField({
  label,
  options,
  value,
  error,
  onPick,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  error?: string;
  onPick: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition ${
              value === option.value
                ? "border-violet bg-tint-soft text-violet-ink"
                : "border-line bg-white text-ink hover:border-violet/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  maxLength: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
      />
      <FieldError message={error} />
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  error,
  min,
  max,
  step,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  min: number;
  max: number;
  step: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </span>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
      />
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="mt-1 block text-[11.5px] text-red">{message}</span>
  ) : null;
}
