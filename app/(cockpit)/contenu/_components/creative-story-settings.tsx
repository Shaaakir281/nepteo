"use client";

import { CREATIVE_IMAGE_FORMATS, type CreativeImageFormat } from "@/lib/creative-image-rules";
import type { CampaignCreativeSource } from "@/lib/campaign-creative-rules";

const STATUS_LABELS: Record<string, string> = {
  proposed: "À valider",
  approved: "Validée",
  postponed: "Reportée",
};

export function CreativeStorySettings({ campaigns, campaign, campaignId, freeMode, format, objective, canEdit, campaignLocked, loading, onChooseCampaign, onFormat, onObjective }: {
  campaigns: CampaignCreativeSource[];
  campaign: CampaignCreativeSource | null;
  campaignId: string | null;
  freeMode: boolean;
  format: CreativeImageFormat;
  objective: string;
  canEdit: boolean;
  campaignLocked: boolean;
  loading: boolean;
  onChooseCampaign: (id: string) => void;
  onFormat: (format: CreativeImageFormat) => void;
  onObjective: (objective: string) => void;
}) {
  return (
    <details className="rounded-[11px] border border-line-soft px-4 py-3">
      <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">
        Réglages <span className="ml-1 text-[10.5px] font-medium text-faint">campagne, format, message</span>
      </summary>
      <div className="mt-4 space-y-4 border-t border-line-soft pt-4">
        {!freeMode && campaigns.length > 0 && (
          <div>
            <label htmlFor="creative-campaign" className="text-[11.5px] font-semibold text-ink">Campagne source</label>
            <select id="creative-campaign" value={campaignId ?? ""} onChange={(event) => onChooseCampaign(event.target.value)} disabled={loading} className="mt-2 w-full rounded-[9px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-ink disabled:bg-tint-soft">
              {campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            {campaign && <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{STATUS_LABELS[campaign.status] ?? campaign.status} · {campaign.context || "Brief et message repris automatiquement."}</p>}
          </div>
        )}

        <fieldset>
          <legend className="text-[11.5px] font-semibold text-ink">Format</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(CREATIVE_IMAGE_FORMATS) as CreativeImageFormat[]).map((id) => {
              const item = CREATIVE_IMAGE_FORMATS[id];
              const selected = format === id;
              const recommended = campaign?.recommendedFormat === id && !freeMode;
              return (
                <button key={id} type="button" aria-pressed={selected} onClick={() => onFormat(id)} disabled={campaignLocked || loading} className={`rounded-[9px] border px-2.5 py-2 text-left ${selected ? "border-violet bg-tint text-violet-ink" : "border-line bg-white text-body"}`}>
                  <span className="block text-[12px] font-semibold">{item.label}</span>
                  <span className="text-[10px] text-muted">{item.ratio}{recommended ? " · conseillé" : ""}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label htmlFor="creative-objective" className="block text-[11.5px] font-semibold text-ink">
          {freeMode ? "Votre message" : "Message proposé"}
          <textarea id="creative-objective" value={objective} onChange={(event) => onObjective(event.target.value)} disabled={!canEdit || campaignLocked || loading} maxLength={500} rows={3} placeholder="Le message à illustrer" className="mt-2 w-full resize-none rounded-[9px] border border-line bg-white px-3.5 py-3 text-[13px] leading-relaxed text-ink disabled:bg-tint-soft" />
        </label>
        {!freeMode && (
          <p className="text-[10.5px] text-faint">
            {campaignLocked
              ? "Campagne validée · visuel final · consultation et téléchargement uniquement"
              : campaign?.status === "approved"
                ? "Campagne déjà validée · choisissez une version pour valider son visuel"
                : "Message repris de la campagne · modifiable avant génération"}
          </p>
        )}
      </div>
    </details>
  );
}
