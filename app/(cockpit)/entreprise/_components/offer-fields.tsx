import { FIELD } from "@/components/ui/styles";
import type { Offer } from "@/lib/memory";

export function OfferFields({ offer }: { offer?: Offer }) {
  return (
    <>
      <input
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={offer?.name ?? ""}
        placeholder="Nom de l’offre"
        className={FIELD}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input name="price" maxLength={200} defaultValue={offer?.price ?? ""} placeholder="Prix" className={FIELD} />
        <input name="target" maxLength={200} defaultValue={offer?.target ?? ""} placeholder="Cible" className={FIELD} />
        <input name="promise" maxLength={200} defaultValue={offer?.promise ?? ""} placeholder="Résultat promis" className={FIELD} />
      </div>
    </>
  );
}
