"use client";

import { metricLabel, metricUnit, type CampaignBrief, type CampaignPlan } from "@/lib/campaign-plan";
import type { CampaignExpectedFormat } from "@/lib/campaign-studio";
import type { CampaignEvidence, CampaignProjectionResult } from "@/lib/campaign-evidence";
import type { CampaignGenerationTrace } from "@/lib/campaign";
import { CampaignCompetitionResearch } from "./campaign-competition-research";

export function CampaignProposalEvidence({ brief, plan, evidence, projection, expectedFormats, generation, demo, onResearchBusyChange }: {
  brief: CampaignBrief;
  plan: CampaignPlan;
  evidence: CampaignEvidence;
  projection: CampaignProjectionResult;
  expectedFormats: CampaignExpectedFormat[];
  generation: CampaignGenerationTrace;
  demo: boolean;
  onResearchBusyChange: (busy: boolean) => void;
}) {
  const source = evidence.source;
  return (
    <div className="mt-4 space-y-4 border-t border-line-soft pt-4">
      <section className="rounded-[10px] bg-tint-soft/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-body">
        <b className="text-ink">Succès visé :</b> {metricLabel(brief.primaryMetric)} ≥ {brief.successThreshold} {metricUnit(brief.primaryMetric)}. Ce seuil vient du brief, pas d&apos;une prévision.
      </section>

      <section>
        <SectionLabel>Faits, méthode et estimation</SectionLabel>
        <p className="text-[11.5px] leading-relaxed text-body">
          Source : {source.label || "aucune source exploitable"}{source.from && source.to ? ` · ${source.from} → ${source.to}` : ""}{source.rowCount > 0 ? ` · ${source.rowCount} lignes / ${source.campaignCount} campagnes` : ""}.
        </p>
        {evidence.facts && <p className="mt-1 text-[11.5px] text-body">Observé : {evidence.facts.spend} € dépensés, {evidence.facts.conversions} conversions, ROAS {evidence.facts.roas ?? "—"}×. Ces faits ne prédisent pas la suite.</p>}
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{evidence.method.aggregation}</p>
        {projection.status === "available" ? (
          <p className="mt-2 rounded-[8px] bg-tint-soft px-2.5 py-2 text-[11px] text-body">Estimation : {projection.projection.volume.low}–{projection.projection.volume.high} conversions, bande heuristique ±30 %. Ce n&apos;est pas un intervalle statistique calibré.</p>
        ) : (
          <p className="mt-2 rounded-[8px] bg-amber-tint px-2.5 py-2 text-[11px] text-body">Données insuffisantes : aucune projection de coût, volume ou ROAS n&apos;est affichée.</p>
        )}
      </section>

      <section>
        <SectionLabel>Formats attendus</SectionLabel>
        <div className="flex flex-wrap gap-2">{expectedFormats.map((format) => <span key={format.value} className="rounded-full bg-tint px-2.5 py-1 text-[10.5px] font-semibold text-violet">{format.label}</span>)}</div>
        <p className="mt-1 text-[10.5px] text-faint">Pas encore contrôlés par un fournisseur.</p>
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        <Limit label="Budget total redérivé" value={`${plan.totalBudget} €`} />
        <Limit label="Limite journalière" value={`${plan.dailyCap} € / j`} />
        <Limit label="Condition de lancement" value="Non lancée" />
      </section>

      <CampaignCompetitionResearch brief={brief} disabled={demo} onBusyChange={onResearchBusyChange} />
      <p className="text-[10.5px] leading-relaxed text-faint">
        {generation.mode === "ai"
          ? `Appel IA unique tracé · tâche ${generation.task} · modèle ${generation.model}${generation.totalTokens == null ? "" : ` · ${generation.totalTokens} jetons`}.`
          : `Hooks de repli locaux · aucun retry automatique après ${generation.reason === "timeout" ? "le délai dépassé" : "l'échec IA"}.`}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">{children}</h4>;
}

function Limit({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[9px] border border-line-soft px-3 py-2"><p className="text-[10px] font-semibold text-faint">{label}</p><p className="mt-0.5 text-[11.5px] font-semibold text-ink">{value}</p></div>;
}
