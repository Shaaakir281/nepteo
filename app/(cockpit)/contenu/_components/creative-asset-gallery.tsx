"use client";

import Link from "next/link";
import { CREATIVE_IMAGE_FORMATS } from "@/lib/creative-image-rules";
import type { CreativeAsset } from "@/lib/creative-asset-rules";

export function CreativeAssetGallery({ freeMode, assets, total, page, pageSize, canEdit, campaignLocked, loading, selectingId, onSelect }: {
  freeMode: boolean;
  assets: CreativeAsset[];
  total: number;
  page: number;
  pageSize: number;
  canEdit: boolean;
  campaignLocked: boolean;
  loading: boolean;
  selectingId: string | null;
  onSelect: (asset: CreativeAsset) => void;
}) {
  if (assets.length === 0 && (!freeMode || total === 0)) return null;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return (
    <details className="rounded-[11px] border border-line-soft px-4 py-3">
      <summary className="cursor-pointer text-[12.5px] font-semibold text-violet">
        Versions enregistrées <span className="ml-1 text-[10.5px] font-medium text-faint">{freeMode ? `${total} au total` : campaignLocked ? "visuel final" : `${assets.length}/5`}</span>
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {assets.map((asset) => {
          const retained = asset.status === "selected" || asset.status === "validated";
          return (
            <button key={asset.id} type="button" onClick={() => onSelect(asset)} disabled={loading || selectingId === asset.id} className={`overflow-hidden rounded-[9px] border text-left ${retained ? "border-[#2d5ba7] bg-[#eaf0f9]" : "border-line bg-white"}`}>
              <span className="block h-14 bg-[#ddd4c7] bg-cover bg-center" style={asset.imageUrl ? { backgroundImage: `url(${asset.imageUrl})` } : undefined} />
              <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="text-[11px] font-semibold text-ink">{freeMode ? CREATIVE_IMAGE_FORMATS[asset.format].label : `Version ${asset.version}`}</span>
                <span className="text-[9.5px] font-semibold text-muted">{selectingId === asset.id ? "Sélection…" : retained ? asset.status === "validated" ? "Validée" : "Retenue" : canEdit && !campaignLocked ? "Choisir" : "Aperçu"}</span>
              </span>
            </button>
          );
        })}
      </div>
      {freeMode && pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-[10.5px] font-semibold">
          {page > 1 ? <Link href={`/contenu?libre=1&creatives_page=${page - 1}`} className="text-violet">Plus récentes</Link> : <span />}
          <span className="text-faint">Page {page}/{pageCount}</span>
          {page < pageCount ? <Link href={`/contenu?libre=1&creatives_page=${page + 1}`} className="text-violet">Plus anciennes</Link> : <span />}
        </div>
      )}
    </details>
  );
}
