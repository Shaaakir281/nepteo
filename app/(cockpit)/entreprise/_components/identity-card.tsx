import { Card } from "@/components/ui/card";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { TagList } from "@/components/ui/tag";
import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  OBJECTIVE_OPTIONS,
  PHILOSOPHY_MAX,
  type MemoryContent,
} from "@/lib/memory";
import {
  saveActivite,
  saveCanaux,
  saveObjectifs,
  savePhilosophie,
  savePresence,
  saveTon,
  saveZone,
} from "../actions";
import { MemRow } from "./mem-row";

export function IdentityCard({
  mem,
  canEdit,
  saved,
}: {
  mem: Partial<MemoryContent>;
  canEdit: boolean;
  saved?: string;
}) {
  const channels = mem.canaux?.list ?? [];
  const objectives = mem.objectifs?.list ?? [];

  return (
    <Card title="Identité & activité" sub="Modifiable à tout moment">
      <MemRow
        label="Activité"
        canEdit={canEdit}
        saved={saved === "activite"}
        value={mem.activite?.activity_type}
        sub={
          mem.activite?.audience
            ? `Clients : ${mem.activite.audience.toLowerCase()}`
            : undefined
        }
      >
        <form action={saveActivite}>
          <p className="mb-2 text-[12px] font-semibold text-ink">
            Que propose votre entreprise ?
          </p>
          <ChipGroup>
            {ACTIVITY_OPTIONS.map((o) => (
              <Chip
                key={o}
                type="radio"
                name="activity_type"
                value={o}
                defaultChecked={mem.activite?.activity_type === o}
                required
              />
            ))}
          </ChipGroup>
          <p className="mb-2 mt-4 text-[12px] font-semibold text-ink">
            À qui vendez-vous principalement ?
          </p>
          <ChipGroup>
            {AUDIENCE_OPTIONS.map((o) => (
              <Chip
                key={o}
                type="radio"
                name="audience"
                value={o}
                defaultChecked={mem.activite?.audience === o}
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
            placeholder="Exemple : Nous fabriquons des menuiseries sur mesure pour des architectes et des particuliers, principalement en Île-de-France…"
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>

      <MemRow
        label="Zone"
        canEdit={canEdit}
        saved={saved === "zone"}
        value={mem.zone?.text}
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
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>

      <MemRow
        label="Canaux actuels"
        canEdit={canEdit}
        saved={saved === "canaux"}
        value={channels.length > 0 ? <TagList items={channels} /> : undefined}
        sub="Comment vos clients vous trouvent aujourd'hui"
      >
        <form action={saveCanaux}>
          <ChipGroup>
            {CHANNEL_OPTIONS.map((c) => (
              <Chip
                key={c}
                type="checkbox"
                name="channels"
                value={c}
                defaultChecked={channels.includes(c)}
              />
            ))}
          </ChipGroup>
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>

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
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>

      <MemRow
        label="Communication"
        canEdit={canEdit}
        saved={saved === "presence"}
        value={
          (mem.presence?.list ?? []).length > 0 ? (
            <TagList items={mem.presence!.list!} />
          ) : undefined
        }
        sub="Ce que vous faites déjà publiquement — pour ne pas vous le reproposer"
      >
        <form action={savePresence}>
          <p className="mb-2 text-[12px] text-muted">
            Une observation par ligne (publicités en cours, promotion,
            newsletter, rythme de publication…).
          </p>
          <textarea
            name="text"
            rows={4}
            defaultValue={(mem.presence?.list ?? []).join("\n")}
            placeholder={"Publicités Meta actives sur le coffret découverte\nNewsletter mensuelle\nInstagram, 3 publications par semaine"}
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>

      <MemRow
        label="Philosophie"
        canEdit={canEdit}
        saved={saved === "philosophie"}
        value={
          mem.philosophie?.text ? (
            <span className="line-clamp-2 whitespace-pre-line">
              {mem.philosophie.text}
            </span>
          ) : undefined
        }
        sub="Votre façon de travailler, ce à quoi vous tenez — Nepteo s'en sert pour écrire comme vous"
      >
        <form action={savePhilosophie}>
          <textarea
            name="text"
            rows={5}
            maxLength={PHILOSOPHY_MAX}
            defaultValue={mem.philosophie?.text ?? ""}
            placeholder="Exemple : je travaille en direct, sans intermédiaire. Je préfère perdre une vente que promettre ce que je ne peux pas tenir."
            className={FIELD}
          />
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>

      <MemRow
        label="Objectifs"
        canEdit={canEdit}
        saved={saved === "objectifs"}
        value={objectives.length > 0 ? <TagList items={objectives} /> : undefined}
        sub="Le cockpit et les priorités s'organisent autour de ces objectifs"
      >
        <form action={saveObjectifs}>
          <p className="mb-2 text-[12px] text-muted">
            Choisissez <b className="text-ink">deux objectifs maximum</b> —
            l&apos;agent doit rester concentré.
          </p>
          <ChipGroup>
            {OBJECTIVE_OPTIONS.map((o) => (
              <Chip
                key={o}
                type="checkbox"
                name="objectives"
                value={o}
                defaultChecked={objectives.includes(o)}
              />
            ))}
          </ChipGroup>
          <div className="mt-3">
            <button type="submit" className={SAVE_BTN}>
              Enregistrer
            </button>
          </div>
        </form>
      </MemRow>
    </Card>
  );
}
