import { Chip, ChipGroup } from "@/components/ui/chip";
import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  type MemoryContent,
  type Offer,
} from "@/lib/memory";
import { saveActivite, saveZone } from "../actions";
import { MemRow } from "./mem-row";
import { MemoryGroup } from "./memory-group";
import { OffersCard } from "./offers-card";

export function SellingMemoryFields({
  mem,
  offers,
  canEdit,
  saved,
}: {
  mem: Partial<MemoryContent>;
  offers: Offer[];
  canEdit: boolean;
  saved?: string;
}) {
  const activityValue = [
    mem.activite?.activity_type,
    mem.activite?.audience,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MemoryGroup title="Ce que je vends">
      <MemRow
        label="Activité"
        canEdit={canEdit}
        saved={saved === "activite"}
        value={activityValue || undefined}
        sub="Ce que vous proposez et à qui vous le vendez"
      >
        <form action={saveActivite}>
          <p className="mb-2 text-[12px] font-semibold text-ink">
            Que propose votre entreprise ?
          </p>
          <ChipGroup>
            {ACTIVITY_OPTIONS.map((option) => (
              <Chip
                key={option}
                type="radio"
                name="activity_type"
                value={option}
                defaultChecked={mem.activite?.activity_type === option}
                required
              />
            ))}
          </ChipGroup>
          <p className="mb-2 mt-4 text-[12px] font-semibold text-ink">
            À qui vendez-vous principalement ?
          </p>
          <ChipGroup>
            {AUDIENCE_OPTIONS.map((option) => (
              <Chip
                key={option}
                type="radio"
                name="audience"
                value={option}
                defaultChecked={mem.activite?.audience === option}
                required
              />
            ))}
          </ChipGroup>
          <p className="mb-2 mt-4 text-[12px] font-semibold text-ink">
            Avec vos propres mots{" "}
            <span className="font-normal text-faint">(facultatif)</span>
          </p>
          <textarea
            name="description"
            rows={3}
            maxLength={1000}
            defaultValue={mem.activite?.description ?? ""}
            placeholder="Exemple : nous fabriquons des menuiseries sur mesure…"
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
      <MemRow
        label="Zone"
        canEdit={canEdit}
        saved={saved === "zone"}
        value={mem.zone?.text}
        sub="Le territoire dans lequel vous travaillez"
      >
        <form action={saveZone}>
          <input
            name="text"
            maxLength={200}
            required
            defaultValue={mem.zone?.text ?? ""}
            placeholder="Ex. : France — principalement Île-de-France"
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
      <OffersCard
        offers={offers}
        canEdit={canEdit}
        saved={saved === "offres"}
      />
    </MemoryGroup>
  );
}
