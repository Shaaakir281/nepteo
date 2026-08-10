import { Chip, ChipGroup } from "@/components/ui/chip";
import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import {
  CHANNEL_OPTIONS,
  OBJECTIVE_OPTIONS,
  type MemoryContent,
} from "@/lib/memory";
import { saveCanaux, saveObjectifs, savePresence } from "../actions";
import { MemRow } from "./mem-row";
import { MemoryGroup } from "./memory-group";

export function MarketingMemoryFields({
  mem,
  canEdit,
  saved,
}: {
  mem: Partial<MemoryContent>;
  canEdit: boolean;
  saved?: string;
}) {
  const channels = mem.canaux?.list ?? [];
  const presence = mem.presence?.list ?? [];
  const objectives = mem.objectifs?.list ?? [];

  return (
    <MemoryGroup title="Ce que je fais déjà">
      <MemRow
        label="Canaux"
        canEdit={canEdit}
        saved={saved === "canaux"}
        value={channels.length ? `${channels.length} canal${channels.length > 1 ? "aux" : ""}` : undefined}
        sub="Comment vos clients vous trouvent aujourd’hui"
      >
        <form action={saveCanaux}>
          <ChipGroup>
            {CHANNEL_OPTIONS.map((channel) => (
              <Chip
                key={channel}
                type="checkbox"
                name="channels"
                value={channel}
                defaultChecked={channels.includes(channel)}
              />
            ))}
          </ChipGroup>
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
      <MemRow
        label="Communication"
        canEdit={canEdit}
        saved={saved === "presence"}
        value={presence.length ? `${presence.length} élément${presence.length > 1 ? "s" : ""}` : undefined}
        sub="Ce que vous faites déjà publiquement, pour ne pas vous le reproposer"
      >
        <form action={savePresence}>
          <p className="mb-2 text-[12px] text-muted">
            Une observation par ligne.
          </p>
          <textarea
            name="text"
            rows={4}
            defaultValue={presence.join("\n")}
            placeholder="Newsletter mensuelle\nInstagram, 3 publications par semaine"
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
      <MemRow
        label="Objectifs"
        canEdit={canEdit}
        saved={saved === "objectifs"}
        value={objectives.length ? `${objectives.length} objectif${objectives.length > 1 ? "s" : ""}` : undefined}
        sub="Le cockpit et les priorités s’organisent autour de ces objectifs"
      >
        <form action={saveObjectifs}>
          <p className="mb-2 text-[12px] text-muted">
            Choisissez <b className="text-ink">deux objectifs maximum</b>.
          </p>
          <ChipGroup>
            {OBJECTIVE_OPTIONS.map((objective) => (
              <Chip
                key={objective}
                type="checkbox"
                name="objectives"
                value={objective}
                defaultChecked={objectives.includes(objective)}
              />
            ))}
          </ChipGroup>
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
    </MemoryGroup>
  );
}
