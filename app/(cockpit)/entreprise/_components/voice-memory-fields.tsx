import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import { PHILOSOPHY_MAX, type MemoryContent } from "@/lib/memory";
import { savePhilosophie, saveTon } from "../actions";
import { MemRow } from "./mem-row";
import { MemoryGroup } from "./memory-group";

export function VoiceMemoryFields({
  mem,
  canEdit,
  saved,
}: {
  mem: Partial<MemoryContent>;
  canEdit: boolean;
  saved?: string;
}) {
  return (
    <MemoryGroup title="Comment je parle">
      <MemRow
        label="Ton"
        canEdit={canEdit}
        saved={saved === "ton"}
        value={mem.ton?.text}
        sub="Utilisé pour tous les emails et publications rédigés par Nepteo"
      >
        <form action={saveTon}>
          <textarea
            name="text"
            rows={2}
            maxLength={500}
            required
            defaultValue={mem.ton?.text ?? ""}
            placeholder="Ex. : professionnel, direct, sans jargon"
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
      <MemRow
        label="Philosophie"
        canEdit={canEdit}
        saved={saved === "philosophie"}
        value={mem.philosophie?.text}
        sub="Votre façon de travailler et ce que vous refusez de promettre"
      >
        <form action={savePhilosophie}>
          <textarea
            name="text"
            rows={5}
            maxLength={PHILOSOPHY_MAX}
            defaultValue={mem.philosophie?.text ?? ""}
            placeholder="Exemple : je préfère perdre une vente que promettre ce que je ne peux pas tenir."
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>Enregistrer</button>
          </div>
        </form>
      </MemRow>
    </MemoryGroup>
  );
}
