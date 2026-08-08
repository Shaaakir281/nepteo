"use client";

import { useState } from "react";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_TEXT_LIMITS,
  metricLabel,
  metricUnit,
  type CampaignBrief,
  type CampaignPlan,
} from "@/lib/campaign-plan";
import {
  CAMPAIGN_AUDIENCE_STRATEGIES,
  CAMPAIGN_STUDIO_LIMITS,
  type CampaignExpectedFormat,
  type CampaignStudioDraft,
} from "@/lib/campaign-studio";
import type {
  CampaignEvidence,
  CampaignProjectionResult,
} from "@/lib/campaign-evidence";
import type { CampaignGenerationTrace } from "@/lib/campaign";
import { researchCampaignCompetitionAction } from "../actions";

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
  const allocationTotal = studio.adSets.reduce(
    (sum, adSet) => sum + adSet.allocationBps,
    0,
  );
  return (
    <div className="space-y-5">
      {demo && (
        <Notice>
          Scénario d&apos;exemple : les observations affichées ne constituent pas
          une preuve terrain et aucune recherche payante n&apos;est autorisée.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Budget total" value={`${plan.totalBudget} €`} />
        <Metric label="Durée" value={`${plan.durationDays} j`} />
        <Metric
          label="Coût / conversion"
          value={
            projection.status === "available"
              ? `${projection.projection.costPerContact.low}–${projection.projection.costPerContact.high} €`
              : "Données insuffisantes"
          }
        />
        <Metric
          label="Confiance de l'estimation"
          value={
            projection.status === "available"
              ? `${Math.round(projection.projection.confidence * 100)} %`
              : "Non calculée"
          }
        />
      </div>

      <EvidencePanel evidence={evidence} projection={projection} />

      <div className="rounded-[10px] border border-line-soft bg-tint-soft/40 px-3 py-2.5 text-[12px] leading-relaxed text-body">
        <b className="text-ink">Succès visé :</b>{" "}
        {metricLabel(brief.primaryMetric)} ≥ {brief.successThreshold}{" "}
        {metricUnit(brief.primaryMetric)}. Ce seuil vient du brief ; il ne prouve
        pas une performance future.
      </div>

      <section>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Structure et allocation</SectionLabel>
          <button
            type="button"
            disabled={studio.adSets.length >= CAMPAIGN_STUDIO_LIMITS.adSets.max}
            onClick={() => addAdSet(studio, brief, onStudioChange)}
            className="rounded-[8px] border border-line px-2.5 py-1.5 text-[11px] font-semibold text-violet disabled:opacity-40"
          >
            + Ajouter un adset
          </button>
        </div>
        <p className={`mb-2 text-[11.5px] ${allocationTotal === 10_000 ? "text-muted" : "text-red"}`}>
          Allocation totale : {(allocationTotal / 100).toFixed(2)} % — le serveur
          exige exactement 100 % et redérive chaque budget.
        </p>
        <div className="space-y-3">
          {studio.adSets.map((adSet, index) => (
            <div key={adSet.id} className="rounded-[12px] border border-line-soft p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-ink">
                  Adset {index + 1} · Ajuster
                </p>
                {studio.adSets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAdSet(studio, index, onStudioChange)}
                    className="text-[11px] font-semibold text-red"
                  >
                    Retirer
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <StudioInput
                  label="Nom"
                  value={adSet.name}
                  maxLength={CAMPAIGN_STUDIO_LIMITS.adSetName.max}
                  onChange={(name) => updateAdSet(studio, index, { name }, onStudioChange)}
                />
                <label className="block text-[11px] font-semibold text-faint">
                  Objectif
                  <select
                    value={adSet.objective}
                    onChange={(event) =>
                      updateAdSet(studio, index, { objective: event.target.value }, onStudioChange)
                    }
                    className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body"
                  >
                    {CAMPAIGN_OBJECTIVES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <StudioInput
                  label="Audience"
                  value={adSet.audience}
                  maxLength={CAMPAIGN_TEXT_LIMITS.audience.max}
                  onChange={(audience) => updateAdSet(studio, index, { audience }, onStudioChange)}
                />
                <label className="block text-[11px] font-semibold text-faint">
                  Stratégie — hypothèse à arbitrer
                  <select
                    value={adSet.strategy}
                    onChange={(event) =>
                      updateAdSet(
                        studio,
                        index,
                        { strategy: event.target.value as typeof adSet.strategy },
                        onStudioChange,
                      )
                    }
                    className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body"
                  >
                    {CAMPAIGN_AUDIENCE_STRATEGIES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <StudioInput
                  label="Hypothèse de cet adset"
                  value={adSet.hypothesis}
                  maxLength={CAMPAIGN_TEXT_LIMITS.hypothesis.max}
                  onChange={(hypothesis) =>
                    updateAdSet(studio, index, { hypothesis }, onStudioChange)
                  }
                />
                <label className="block text-[11px] font-semibold text-faint">
                  Allocation (%)
                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={adSet.allocationBps / 100}
                    onChange={(event) =>
                      updateAdSet(
                        studio,
                        index,
                        { allocationBps: Math.round(Number(event.target.value) * 100) },
                        onStudioChange,
                      )
                    }
                    className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body"
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Cette stratégie reste une hypothèse éditable, pas une audience fournisseur observée. Budget
                indicatif : {(plan.totalBudget * adSet.allocationBps / 10_000).toFixed(2)} €.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Hooks éditables et sélectionnés</SectionLabel>
          <button
            type="button"
            disabled={studio.hooks.length >= CAMPAIGN_STUDIO_LIMITS.hooks.max}
            onClick={() =>
              onStudioChange({ ...studio, hooks: [...studio.hooks, ""] })
            }
            className="rounded-[8px] border border-line px-2.5 py-1.5 text-[11px] font-semibold text-violet disabled:opacity-40"
          >
            + Ajouter un hook
          </button>
        </div>
        <div className="space-y-2.5">
          {studio.hooks.map((hook, index) => (
            <div key={index} className="flex items-start gap-2">
              <input
                type="checkbox"
                aria-label={`Retenir le hook ${hookLabel(index)}`}
                checked={studio.selectedHookIndices.includes(index)}
                onChange={() => toggleHook(studio, index, onStudioChange)}
                className="mt-3"
              />
              {hook.trim().length < CAMPAIGN_STUDIO_LIMITS.hookText.min && (
                <span className="mt-2 text-[11px] text-red">
                  Minimum {CAMPAIGN_STUDIO_LIMITS.hookText.min} caractères.
                </span>
              )}
              <label className="mt-2 flex-none text-[12px] font-bold text-violet">
                {hookLabel(index)}
              </label>
              <textarea
                aria-label={`Texte du hook ${hookLabel(index)}`}
                value={hook}
                maxLength={CAMPAIGN_STUDIO_LIMITS.hookText.max}
                rows={3}
                onChange={(event) => {
                  const hooks = [...studio.hooks];
                  hooks[index] = event.target.value;
                  onStudioChange({ ...studio, hooks });
                }}
                className="w-full resize-y rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] leading-relaxed text-body"
              />
              {studio.hooks.length > CAMPAIGN_STUDIO_LIMITS.hooks.min && (
                <button
                  type="button"
                  aria-label={`Retirer le hook ${hookLabel(index)}`}
                  onClick={() => removeHook(studio, index, onStudioChange)}
                  className="mt-2 text-[12px] text-red"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {studio.selectedHookIndices.length === 0 && (
          <p className="mt-2 text-[11.5px] text-red">Sélectionnez au moins un hook avant la soumission.</p>
        )}
      </section>

      <section>
        <SectionLabel>Formats attendus — pas encore contrôlés par un fournisseur</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {expectedFormats.map((format) => (
            <span key={format.value} className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-semibold text-violet">
              {format.label}
            </span>
          ))}
        </div>
      </section>

      <CompetitionResearch
        brief={brief}
        disabled={demo}
        onBusyChange={onResearchBusyChange}
      />

      <p className="text-[11px] leading-relaxed text-faint">
        {generation.mode === "ai"
          ? `Appel IA unique tracé · tâche ${generation.task} · modèle ${generation.model}${generation.totalTokens == null ? "" : ` · ${generation.totalTokens} jetons`}.`
          : `Hooks de repli locaux · aucun retry automatique après ${generation.reason === "timeout" ? "le délai dépassé" : "l'échec IA"}.`}
      </p>
    </div>
  );
}

export function CampaignGuards({ plan }: { plan: CampaignPlan }) {
  return (
    <div className="space-y-3">
      <Limit label="Limite journalière de la proposition" value={`${plan.dailyCap} € / j`}>
        Montant recalculé côté serveur ; aucun contrôle fournisseur n&apos;est actif.
      </Limit>
      <Limit label="Durée finie de la proposition" value={`${plan.durationDays} jours`}>
        Le budget total est redérivé à la soumission.
      </Limit>
      <Limit label="Condition avant tout lancement futur" value="Non lancée">
        Aucun préflight, aucune publication et aucune dépense ne sont disponibles dans CAMP-1.
      </Limit>
    </div>
  );
}

export function CampaignProposalSummary({
  brief,
  plan,
  evidence,
  projection,
  studio,
  expectedFormats,
}: {
  brief: CampaignBrief;
  plan: CampaignPlan;
  evidence: CampaignEvidence;
  projection: CampaignProjectionResult;
  studio: CampaignStudioDraft;
  expectedFormats: CampaignExpectedFormat[];
}) {
  const selectedHooks = studio.selectedHookIndices.map((index) => studio.hooks[index]);
  return (
    <div className="mb-5 space-y-4">
      <section className="rounded-[12px] border border-line-soft p-3.5">
        <SectionLabel>Récapitulatif complet avant ajout à la file</SectionLabel>
        <dl className="space-y-1 text-[12px] leading-relaxed text-body">
          <div><dt className="inline font-semibold text-ink">Brief : </dt><dd className="inline">{brief.audience} · {brief.offer}</dd></div>
          <div><dt className="inline font-semibold text-ink">Budget : </dt><dd className="inline">{plan.totalBudget} € sur {plan.durationDays} jours</dd></div>
          <div><dt className="inline font-semibold text-ink">Succès visé : </dt><dd className="inline">{metricLabel(brief.primaryMetric)} ≥ {brief.successThreshold} {metricUnit(brief.primaryMetric)}</dd></div>
          <div><dt className="inline font-semibold text-ink">Preuve : </dt><dd className="inline">{evidence.source.label || "aucune"}{evidence.source.from ? ` · ${evidence.source.from} → ${evidence.source.to}` : ""} · projection {projection.status === "available" ? "disponible" : "non calculée"}</dd></div>
        </dl>
      </section>
      <section>
        <SectionLabel>Adsets et budgets redérivés au serveur</SectionLabel>
        <div className="space-y-2">
          {studio.adSets.map((adSet) => (
            <div key={adSet.id} className="rounded-[10px] bg-tint-soft px-3 py-2 text-[12px] text-body">
              <b className="text-ink">{adSet.name}</b> · {(adSet.allocationBps / 100).toFixed(2)} % · {(plan.totalBudget * adSet.allocationBps / 10_000).toFixed(2)} €<br />
              {adSet.audience} · hypothèse : {adSet.hypothesis}
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionLabel>Hooks retenus</SectionLabel>
        <ol className="space-y-1.5 text-[12px] text-body">
          {selectedHooks.map((hook, index) => <li key={`${index}-${hook}`}><b className="text-ink">{hookLabel(studio.selectedHookIndices[index])} · </b>{hook}</li>)}
        </ol>
      </section>
      <section>
        <SectionLabel>Formats attendus</SectionLabel>
        <p className="text-[12px] text-body">{expectedFormats.map((format) => format.label).join(" · ")} · aucun contrôle fournisseur effectué.</p>
      </section>
    </div>
  );
}

function EvidencePanel({ evidence, projection }: { evidence: CampaignEvidence; projection: CampaignProjectionResult }) {
  const source = evidence.source;
  return (
    <section className="rounded-[12px] border border-line-soft p-3.5">
      <SectionLabel>Faits, méthode et estimation</SectionLabel>
      <p className="text-[12.5px] leading-relaxed text-body">
        <b className="text-ink">Source :</b> {source.label || "aucune source exploitable"}
        {source.from && source.to ? ` · ${source.from} → ${source.to}` : ""}
        {source.rowCount > 0 ? ` · ${source.rowCount} lignes / ${source.campaignCount} campagnes` : ""}.
      </p>
      {evidence.facts && (
        <div className="mt-1 space-y-1 text-[12px] text-body">
          <p>
            Observé : {evidence.facts.spend} € dépensés, {evidence.facts.conversions} conversions,
            ROAS {evidence.facts.roas ?? "—"}×. Ces faits ne sont pas une prévision.
          </p>
          {evidence.facts.topCampaign && (
            <p>
              Ce qui fonctionne le mieux sur la fenêtre, par volume observé :{" "}
              <b className="text-ink">{evidence.facts.topCampaign.campaignName}</b> ·{" "}
              {evidence.facts.topCampaign.conversions} conversions · ROAS{" "}
              {evidence.facts.topCampaign.roas ?? "—"}×. Ce classement n&apos;établit pas une causalité.
            </p>
          )}
        </div>
      )}
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{evidence.method.aggregation}</p>
      {projection.status === "available" ? (
        <p className="mt-2 rounded-[8px] bg-tint-soft px-2.5 py-2 text-[11.5px] text-body">
          Estimation : {projection.projection.volume.low}–{projection.projection.volume.high} conversions,
          bande heuristique ±30 %. Ce n&apos;est pas un intervalle statistique calibré.
        </p>
      ) : (
        <p className="mt-2 rounded-[8px] bg-amber-tint px-2.5 py-2 text-[11.5px] text-body">
          Données insuffisantes : aucune projection de coût, volume ou ROAS n&apos;est affichée.
        </p>
      )}
    </section>
  );
}

function CompetitionResearch({
  brief,
  disabled,
  onBusyChange,
}: {
  brief: CampaignBrief;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof researchCampaignCompetitionAction>> | null>(null);

  async function run() {
    if (!confirmed || busy || disabled) return;
    setBusy(true);
    onBusyChange(true);
    try {
      setResult(await researchCampaignCompetitionAction({ brief, confirmed: true }));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="rounded-[12px] border border-line-soft p-3.5">
      <SectionLabel>Veille concurrentielle séparée et sourcée</SectionLabel>
      <p className="text-[11.5px] leading-relaxed text-muted">
        Cette recherche peut être payante. Elle utilise `runResearch`, un cache, un journal avant appel,
        un timeout et aucun retry automatique. Elle ne modifie pas la proposition.
      </p>
      <label className="mt-2 flex items-start gap-2 text-[11.5px] text-body">
        <input type="checkbox" checked={confirmed} disabled={disabled} onChange={(event) => setConfirmed(event.target.checked)} />
        Je confirme vouloir lancer cette recherche maintenant.
      </label>
      <button
        type="button"
        disabled={!confirmed || busy || disabled}
        onClick={run}
        className="mt-2 rounded-[9px] border border-violet px-3 py-2 text-[12px] font-semibold text-violet disabled:opacity-40"
      >
        {busy ? "Recherche en cours…" : "Lancer la veille sourcée"}
      </button>
      <div aria-live="polite">
      {result && !result.ok && <p className="mt-2 text-[11.5px] text-red">{researchErrorMessage(result.reason)}</p>}
      {result?.ok && (
        <div className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-body">
          <p>{result.text}</p>
          <p className="text-faint">{result.cached ? "Résultat issu du cache" : "Nouvel appel comptabilisé"} · usage du jour : {result.quota.used}.</p>
          <ul className="space-y-1">
            {result.sources.map((source) => (
              <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-violet underline">{source.title}</a></li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </section>
  );
}

function addAdSet(studio: CampaignStudioDraft, brief: CampaignBrief, onChange: (studio: CampaignStudioDraft) => void) {
  if (studio.adSets.length >= CAMPAIGN_STUDIO_LIMITS.adSets.max) return;
  const adSets = studio.adSets.map((adSet) => ({ ...adSet }));
  const donorIndex = adSets.reduce((best, adSet, index) => adSet.allocationBps > adSets[best].allocationBps ? index : best, 0);
  const allocationBps = Math.min(1_000, adSets[donorIndex].allocationBps - 1);
  if (allocationBps < 1) return;
  adSets[donorIndex].allocationBps -= allocationBps;
  adSets.push({
    id: crypto.randomUUID(),
    name: `Audience ${adSets.length + 1}`,
    objective: brief.objective,
    audience: brief.audience,
    hypothesis: brief.hypothesis,
    strategy: "brief_audience",
    allocationBps,
  });
  onChange({ ...studio, adSets });
}

function removeAdSet(studio: CampaignStudioDraft, index: number, onChange: (studio: CampaignStudioDraft) => void) {
  const removed = studio.adSets[index];
  const adSets = studio.adSets.filter((_, current) => current !== index).map((adSet) => ({ ...adSet }));
  if (adSets[0]) adSets[0].allocationBps += removed.allocationBps;
  onChange({ ...studio, adSets });
}

function updateAdSet(studio: CampaignStudioDraft, index: number, patch: Partial<CampaignStudioDraft["adSets"][number]>, onChange: (studio: CampaignStudioDraft) => void) {
  const adSets = studio.adSets.map((adSet, current) => current === index ? { ...adSet, ...patch } : adSet);
  onChange({ ...studio, adSets });
}

function toggleHook(studio: CampaignStudioDraft, index: number, onChange: (studio: CampaignStudioDraft) => void) {
  const selected = studio.selectedHookIndices.includes(index)
    ? studio.selectedHookIndices.filter((item) => item !== index)
    : [...studio.selectedHookIndices, index].sort((left, right) => left - right);
  onChange({ ...studio, selectedHookIndices: selected });
}

function removeHook(studio: CampaignStudioDraft, index: number, onChange: (studio: CampaignStudioDraft) => void) {
  const hooks = studio.hooks.filter((_, current) => current !== index);
  const selectedHookIndices = studio.selectedHookIndices
    .filter((item) => item !== index)
    .map((item) => item > index ? item - 1 : item);
  onChange({ ...studio, hooks, selectedHookIndices });
}

const hookLabel = (index: number) => String.fromCharCode(65 + index);

function researchErrorMessage(reason: string): string {
  if (reason === "forbidden") return "Votre rôle ne permet pas cette recherche.";
  if (reason === "demo_forbidden") return "La recherche payante est désactivée dans le scénario d'exemple.";
  if (reason === "busy") return "Une autre opération de données est en cours. Réessayez explicitement plus tard.";
  if (reason === "quota_unavailable") return "Le compteur d'usage est indisponible ; aucun appel n'a été lancé.";
  return "La recherche n'a pas abouti. Aucun retry automatique n'a été lancé.";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">{children}</h4>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-faint">{label}</p><p className="mt-0.5 font-display text-[15px] font-semibold text-ink">{value}</p></div>;
}

function StudioInput({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) {
  return <label className="block text-[11px] font-semibold text-faint">{label}<input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body" /></label>;
}

function Limit({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-line-soft px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-[13px] font-semibold text-ink">{label}</p><span className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-semibold text-violet">{value}</span></div><p className="mt-1 text-[12px] leading-relaxed text-muted">{children}</p></div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[10px] bg-amber-tint px-3 py-2.5 text-[12px] leading-relaxed text-body">{children}</p>;
}
