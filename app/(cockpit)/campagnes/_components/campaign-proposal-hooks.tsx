"use client";

import { CAMPAIGN_STUDIO_LIMITS, type CampaignStudioDraft } from "@/lib/campaign-studio";

export function SelectedHook({ hook, index }: { hook: string; index?: number }) {
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">Accroche retenue</p>
      <div className="rounded-[10px] border border-violet/35 bg-tint-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink">
        {hook ? <><b className="text-violet">{hookLabel(index ?? 0)} · </b>{hook}</> : "Sélectionnez au moins une accroche avant la soumission."}
      </div>
    </section>
  );
}

export function CampaignHookEditor({ studio, onChange }: { studio: CampaignStudioDraft; onChange: (studio: CampaignStudioDraft) => void }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[.08em] text-faint">Hooks éditables et sélectionnés</h4>
        <button type="button" disabled={studio.hooks.length >= CAMPAIGN_STUDIO_LIMITS.hooks.max} onClick={() => onChange({ ...studio, hooks: [...studio.hooks, ""] })} className="rounded-[8px] border border-line px-2.5 py-1.5 text-[11px] font-semibold text-violet disabled:opacity-40">+ Ajouter</button>
      </div>
      <p className="mt-1 text-[10.5px] text-muted">Toutes restent éditables. Au moins un hook doit être retenu.</p>
      <div className="mt-3 space-y-2.5">
        {studio.hooks.map((hook, index) => (
          <div key={index} className="flex items-start gap-2">
            <input type="checkbox" aria-label={`Retenir le hook ${hookLabel(index)}`} checked={studio.selectedHookIndices.includes(index)} onChange={() => toggleHook(studio, index, onChange)} className="mt-3" />
            <label className="mt-2 flex-none text-[12px] font-bold text-violet">{hookLabel(index)}</label>
            <textarea aria-label={`Texte du hook ${hookLabel(index)}`} value={hook} maxLength={CAMPAIGN_STUDIO_LIMITS.hookText.max} rows={2} onChange={(event) => { const hooks = [...studio.hooks]; hooks[index] = event.target.value; onChange({ ...studio, hooks }); }} className="w-full resize-y rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] leading-relaxed text-body" />
            {studio.hooks.length > CAMPAIGN_STUDIO_LIMITS.hooks.min && <button type="button" aria-label={`Retirer le hook ${hookLabel(index)}`} onClick={() => removeHook(studio, index, onChange)} className="mt-2 text-[12px] text-red">✕</button>}
          </div>
        ))}
      </div>
      {studio.hooks.some((hook) => hook.trim().length < CAMPAIGN_STUDIO_LIMITS.hookText.min) && <p className="mt-2 text-[11px] text-red">Chaque hook doit contenir au moins {CAMPAIGN_STUDIO_LIMITS.hookText.min} caractères.</p>}
      {studio.selectedHookIndices.length === 0 && <p className="mt-2 text-[11.5px] text-red">Sélectionnez au moins un hook avant la soumission.</p>}
    </section>
  );
}

function toggleHook(studio: CampaignStudioDraft, index: number, onChange: (studio: CampaignStudioDraft) => void) {
  const selectedHookIndices = studio.selectedHookIndices.includes(index) ? studio.selectedHookIndices.filter((item) => item !== index) : [...studio.selectedHookIndices, index].sort((left, right) => left - right);
  onChange({ ...studio, selectedHookIndices });
}

function removeHook(studio: CampaignStudioDraft, index: number, onChange: (studio: CampaignStudioDraft) => void) {
  const hooks = studio.hooks.filter((_, current) => current !== index);
  const selectedHookIndices = studio.selectedHookIndices.filter((item) => item !== index).map((item) => item > index ? item - 1 : item);
  onChange({ ...studio, hooks, selectedHookIndices });
}

const hookLabel = (index: number) => String.fromCharCode(65 + index);
