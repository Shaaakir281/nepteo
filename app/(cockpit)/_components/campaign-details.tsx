import Image from "next/image";
import Link from "next/link";
import type { CreativeAsset } from "@/lib/creative-asset-rules";
import { ValidationSection } from "./validation-section";

/** Complément créatif d'une proposition CAMP, sans remplacer ses preuves ni ses limites. */
export function CampaignCreativeDetails({
  actionId,
  creatives,
}: {
  actionId: string;
  creatives: CreativeAsset[];
}) {
  const selectedCreative =
    creatives.find(
      (creative) =>
        creative.status === "selected" || creative.status === "validated",
    ) ?? creatives[0];
  const retained =
    selectedCreative?.status === "selected" ||
    selectedCreative?.status === "validated";

  return (
    <>
      {selectedCreative?.imageUrl && (
        <>
          <ValidationSection label={retained ? "Visuel retenu" : "Visuel proposé"} />
          <div className="flex items-center gap-3 rounded-[11px] border border-[#b9c9e5] bg-[#eaf0f9] p-2.5">
            <div
              className={`relative w-[82px] flex-none overflow-hidden rounded-[8px] bg-white ${
                selectedCreative.format === "story"
                  ? "aspect-[9/16]"
                  : selectedCreative.format === "square"
                    ? "aspect-square"
                    : "aspect-[3/2]"
              }`}
            >
              <Image
                src={selectedCreative.imageUrl}
                alt="Visuel proposé pour cette campagne"
                fill
                unoptimized
                sizes="82px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-ink">
                Version {selectedCreative.version} ·{" "}
                {selectedCreative.format === "story" ? "Story" : "Visuel"}
              </p>
              <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted">
                {selectedCreative.headline}
              </p>
              <p className="mt-1.5 text-[10.5px] font-semibold text-[#2d5ba7]">
                {retained
                  ? "Sera validé avec la campagne"
                  : "À retenir dans le studio avant validation"}
              </p>
            </div>
          </div>
        </>
      )}

      <Link
        href={`/contenu?campagne=${actionId}`}
        className="mt-4 flex w-full items-center justify-center rounded-[9px] bg-[#8a232d] px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-[#741d25]"
      >
        {selectedCreative
          ? "Voir ou changer de version"
          : "Créer le visuel de cette campagne"}
      </Link>
    </>
  );
}
