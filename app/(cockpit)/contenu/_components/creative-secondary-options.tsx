"use client";

import type { CampaignCreativeSource } from "@/lib/campaign-creative-rules";
import type { CreativeSuggestion } from "@/lib/creative-template";

export function CreativeSecondaryOptions({ suggestions, campaigns, freeMode, loading, onSuggestion, onStartFree, onReturnToCampaign }: {
  suggestions: CreativeSuggestion[];
  campaigns: CampaignCreativeSource[];
  freeMode: boolean;
  loading: boolean;
  onSuggestion: (objective: string) => void;
  onStartFree: () => void;
  onReturnToCampaign: () => void;
}) {
  return (
    <div className="space-y-2">
      <details className="rounded-[11px] border border-line-soft px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">Suggestions de l&apos;agent <span className="ml-1 text-[10.5px] font-medium text-faint">{Math.min(3, suggestions.length)}</span></summary>
        <div className="mt-3 flex flex-wrap gap-2">{suggestions.slice(0, 3).map((suggestion) => <button key={suggestion.label} type="button" onClick={() => onSuggestion(suggestion.objectif)} disabled={loading} className="rounded-full border border-line bg-tint-soft px-3 py-1.5 text-[11.5px] font-medium text-body disabled:opacity-45">{suggestion.label}</button>)}</div>
      </details>
      <details className="rounded-[11px] border border-line-soft px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">Création libre, sans campagne</summary>
        <div className="mt-3 text-[11.5px] leading-relaxed text-muted">
          <p>Ce mode reste séparé des campagnes : son visuel ne sera rattaché à aucune campagne.</p>
          {campaigns.length > 0 && <button type="button" onClick={freeMode ? onReturnToCampaign : onStartFree} disabled={loading} className="mt-2 rounded-[8px] border border-line px-3 py-2 font-semibold text-body disabled:opacity-45">{freeMode ? "Revenir à la campagne récente" : "Ouvrir la création libre"}</button>}
        </div>
      </details>
    </div>
  );
}
