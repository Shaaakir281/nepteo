import { Card } from "@/components/ui/card";
import { icons } from "@/components/icons";
import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import type { Offer } from "@/lib/memory";
import { deleteOffer, saveOffer } from "../actions";

function OfferFields({ offer }: { offer?: Offer }) {
  return (
    <>
      <input
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={offer?.name ?? ""}
        placeholder="Nom de l'offre — ex. : Accompagnement IA pour PME"
        className={FIELD}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input name="price" maxLength={200} defaultValue={offer?.price ?? ""} placeholder="Prix — ex. : 1 500 – 3 000 € / mois" className={FIELD} />
        <input name="target" maxLength={200} defaultValue={offer?.target ?? ""} placeholder="Cible — ex. : PME de services, 5 à 50 salariés" className={FIELD} />
        <input name="promise" maxLength={200} defaultValue={offer?.promise ?? ""} placeholder="Résultat promis" className={FIELD} />
      </div>
    </>
  );
}

function OfferBlock({
  offer,
  index,
  canEdit,
}: {
  offer: Offer;
  index: number;
  canEdit: boolean;
}) {
  return (
    <details className="group mx-[22px] my-4 rounded-[13px] border border-line bg-[#fdfdff]">
      <summary
        className={`p-[18px] ${canEdit ? "cursor-pointer" : "pointer-events-none"}`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="font-display text-[14.5px] font-semibold text-ink">
            {offer.name}
          </span>
          {canEdit && (
            <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet group-open:hidden">
              Modifier
            </span>
          )}
        </span>
        <span className="mt-3 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
          {(
            [
              ["Prix", offer.price],
              ["Cible", offer.target],
              ["Résultat promis", offer.promise],
            ] as const
          ).map(([label, value]) => (
            <span key={label} className="block">
              <span className="block text-[10.5px] font-semibold uppercase tracking-[.06em] text-faint">
                {label}
              </span>
              <span className="mt-0.5 block text-[12.5px] font-medium leading-[1.45] text-ink">
                {value || "—"}
              </span>
            </span>
          ))}
        </span>
      </summary>
      {canEdit && (
        <div className="border-t border-line-soft p-[18px]">
          <form action={saveOffer} className="space-y-3">
            <input type="hidden" name="index" value={index} />
            <OfferFields offer={offer} />
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </form>
          <form action={deleteOffer} className="mt-2">
            <input type="hidden" name="index" value={index} />
            <button
              type="submit"
              className="text-[12px] font-semibold text-red hover:underline"
            >
              Supprimer cette offre
            </button>
          </form>
        </div>
      )}
    </details>
  );
}

export function OffersCard({
  offers,
  canEdit,
  saved,
}: {
  offers: Offer[];
  canEdit: boolean;
  saved?: boolean;
}) {
  return (
    <Card title="Vos offres" sub="Ce que vous vendez" saved={saved}>
      {offers.length === 0 && (
        <p className="px-[22px] pt-4 text-[13px] text-muted">
          Décrivez votre offre principale — Nepteo s&apos;en servira pour les
          campagnes et les contenus.
        </p>
      )}
      {offers.map((o, i) => (
        <OfferBlock key={`${o.name}-${i}`} offer={o} index={i} canEdit={canEdit} />
      ))}

      {canEdit && (
        <details className="group mx-[22px] mb-[18px] mt-2">
          <summary className="flex cursor-pointer items-center justify-center gap-2 rounded-[13px] border-[1.5px] border-dashed border-[#d5d2e8] px-4 py-[11px] text-[13px] font-semibold text-violet transition hover:bg-tint-soft group-open:hidden">
            {icons.plus}
            Ajouter une offre
          </summary>
          <form
            action={saveOffer}
            className="space-y-3 rounded-[13px] border border-line bg-[#fdfdff] p-[18px]"
          >
            <p className="text-[12.5px] text-muted">
              Une <b className="text-ink">offre</b>, c&apos;est ce que vous
              vendez : un service, un produit, un abonnement ou une prestation.
            </p>
            <input type="hidden" name="index" value="new" />
            <OfferFields />
            <button type="submit" className={SAVE_BTN}>
              Ajouter l&apos;offre
            </button>
          </form>
        </details>
      )}
    </Card>
  );
}
