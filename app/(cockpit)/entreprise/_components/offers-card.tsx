import { SAVE_BTN } from "@/components/ui/styles";
import type { Offer } from "@/lib/memory";
import { saveOffer } from "../actions";
import { MemRow } from "./mem-row";
import { OfferEditor } from "./offer-editor";
import { OfferFields } from "./offer-fields";

export function OffersCard({
  offers,
  canEdit,
  saved,
}: {
  offers: Offer[];
  canEdit: boolean;
  saved?: boolean;
}) {
  const value = offers.length
    ? `${offers.length} offre${offers.length > 1 ? "s" : ""}`
    : undefined;

  return (
    <MemRow
      label="Offres"
      value={value}
      sub="Les services, produits ou abonnements que vous vendez"
      canEdit={canEdit}
      saved={saved}
    >
      <div className="space-y-3">
        {offers.map((offer, index) => (
          <OfferEditor
            key={`${offer.name}-${index}`}
            offer={offer}
            index={index}
          />
        ))}
        <form
          action={saveOffer}
          className="space-y-3 rounded-[13px] border border-line bg-white p-4"
        >
          <p className="text-[12px] font-semibold text-ink">
            Ajouter une offre
          </p>
          <input type="hidden" name="index" value="new" />
          <OfferFields />
          <button type="submit" className={SAVE_BTN}>
            Ajouter l&apos;offre
          </button>
        </form>
      </div>
    </MemRow>
  );
}
