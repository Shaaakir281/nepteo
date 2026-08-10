"use client";

import { CAMPAIGN_OBJECTIVES, CAMPAIGN_TEXT_LIMITS, type CampaignBrief, type CampaignPlan } from "@/lib/campaign-plan";
import { CAMPAIGN_AUDIENCE_STRATEGIES, CAMPAIGN_STUDIO_LIMITS, type CampaignStudioDraft } from "@/lib/campaign-studio";

export function CompactAdSetList({ studio, plan }: { studio: CampaignStudioDraft; plan: CampaignPlan }) {
  return (
    <div className="divide-y divide-line-soft rounded-[10px] border border-line-soft">
      {studio.adSets.map((adSet) => (
        <div key={adSet.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12px]">
          <b className="min-w-0 truncate text-ink">{adSet.name}</b>
          <span className="flex-none text-muted">
            {(adSet.allocationBps / 100).toFixed(0)} % · {(plan.dailyCap * adSet.allocationBps / 10_000).toFixed(2)} €/j
          </span>
        </div>
      ))}
    </div>
  );
}

export function CampaignAdSetEditor({ brief, plan, studio, onChange }: { brief: CampaignBrief; plan: CampaignPlan; studio: CampaignStudioDraft; onChange: (studio: CampaignStudioDraft) => void }) {
  const total = studio.adSets.reduce((sum, adSet) => sum + adSet.allocationBps, 0);
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Structure et allocation</SectionLabel>
        <button type="button" disabled={studio.adSets.length >= CAMPAIGN_STUDIO_LIMITS.adSets.max} onClick={() => addAdSet(studio, brief, onChange)} className="rounded-[8px] border border-line px-2.5 py-1.5 text-[11px] font-semibold text-violet disabled:opacity-40">+ Ajouter un adset</button>
      </div>
      <p className={`mb-2 text-[11px] ${total === 10_000 ? "text-muted" : "text-red"}`}>
        Allocation totale : {(total / 100).toFixed(2)} % — le serveur exige 100 % et redérive les budgets.
      </p>
      <div className="space-y-3">
        {studio.adSets.map((adSet, index) => (
          <div key={adSet.id} className="rounded-[10px] border border-line-soft p-3">
            <div className="mb-2 flex items-center justify-between"><b className="text-[12px] text-ink">Adset {index + 1}</b>{studio.adSets.length > 1 && <button type="button" onClick={() => removeAdSet(studio, index, onChange)} className="text-[11px] font-semibold text-red">Retirer</button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StudioInput label="Nom" value={adSet.name} maxLength={CAMPAIGN_STUDIO_LIMITS.adSetName.max} onChange={(name) => updateAdSet(studio, index, { name }, onChange)} />
              <label className="block text-[11px] font-semibold text-faint">Objectif<select value={adSet.objective} onChange={(event) => updateAdSet(studio, index, { objective: event.target.value }, onChange)} className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body">{CAMPAIGN_OBJECTIVES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <StudioInput label="Audience" value={adSet.audience} maxLength={CAMPAIGN_TEXT_LIMITS.audience.max} onChange={(audience) => updateAdSet(studio, index, { audience }, onChange)} />
              <label className="block text-[11px] font-semibold text-faint">Stratégie — hypothèse à arbitrer<select value={adSet.strategy} onChange={(event) => updateAdSet(studio, index, { strategy: event.target.value as typeof adSet.strategy }, onChange)} className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body">{CAMPAIGN_AUDIENCE_STRATEGIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <StudioInput label="Hypothèse de cet adset" value={adSet.hypothesis} maxLength={CAMPAIGN_TEXT_LIMITS.hypothesis.max} onChange={(hypothesis) => updateAdSet(studio, index, { hypothesis }, onChange)} />
              <label className="block text-[11px] font-semibold text-faint">Allocation (%)<input type="number" min="0.01" max="100" step="0.01" value={adSet.allocationBps / 100} onChange={(event) => updateAdSet(studio, index, { allocationBps: Math.round(Number(event.target.value) * 100) }, onChange)} className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body" /></label>
            </div>
            <p className="mt-2 text-[10.5px] text-faint">Hypothèse éditable · budget indicatif {(plan.totalBudget * adSet.allocationBps / 10_000).toFixed(2)} €.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function addAdSet(studio: CampaignStudioDraft, brief: CampaignBrief, onChange: (studio: CampaignStudioDraft) => void) {
  if (studio.adSets.length >= CAMPAIGN_STUDIO_LIMITS.adSets.max) return;
  const adSets = studio.adSets.map((adSet) => ({ ...adSet }));
  const donor = adSets.reduce((best, adSet, index) => adSet.allocationBps > adSets[best].allocationBps ? index : best, 0);
  const allocationBps = Math.min(1_000, adSets[donor].allocationBps - 1);
  if (allocationBps < 1) return;
  adSets[donor].allocationBps -= allocationBps;
  adSets.push({ id: crypto.randomUUID(), name: `Audience ${adSets.length + 1}`, objective: brief.objective, audience: brief.audience, hypothesis: brief.hypothesis, strategy: "brief_audience", allocationBps });
  onChange({ ...studio, adSets });
}

function removeAdSet(studio: CampaignStudioDraft, index: number, onChange: (studio: CampaignStudioDraft) => void) {
  const removed = studio.adSets[index];
  const adSets = studio.adSets.filter((_, current) => current !== index).map((adSet) => ({ ...adSet }));
  if (adSets[0]) adSets[0].allocationBps += removed.allocationBps;
  onChange({ ...studio, adSets });
}

function updateAdSet(studio: CampaignStudioDraft, index: number, patch: Partial<CampaignStudioDraft["adSets"][number]>, onChange: (studio: CampaignStudioDraft) => void) {
  onChange({ ...studio, adSets: studio.adSets.map((adSet, current) => current === index ? { ...adSet, ...patch } : adSet) });
}

function StudioInput({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) {
  return <label className="block text-[11px] font-semibold text-faint">{label}<input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[12.5px] text-body" /></label>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">{children}</h4>;
}
