import { SAVE_BTN } from "@/components/ui/styles";
import type { Offer } from "@/lib/memory";
import { deleteOffer, saveOffer } from "../actions";
import { OfferFields } from "./offer-fields";

export function OfferEditor({
  offer,
  index,
}: {
  offer: Offer;
  index: number;
}) {
  return (
    <details className="group rounded-[11px] border border-line bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="text-[13px] font-semibold text-ink">{offer.name}</span>
        <span aria-hidden="true" className="text-faint transition group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-line-soft p-4">
        <form action={saveOffer} className="space-y-3">
          <input type="hidden" name="index" value={index} />
          <OfferFields offer={offer} />
          <button type="submit" className={SAVE_BTN}>Enregistrer</button>
        </form>
        <form action={deleteOffer} className="mt-2">
          <input type="hidden" name="index" value={index} />
          <button type="submit" className="text-[12px] font-semibold text-red hover:underline">
            Supprimer cette offre
          </button>
        </form>
      </div>
    </details>
  );
}
