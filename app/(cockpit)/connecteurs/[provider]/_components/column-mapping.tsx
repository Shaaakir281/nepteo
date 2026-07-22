import { SAVE_BTN } from "@/components/ui/styles";
import { PROSPECT_FIELDS, type FieldMapping } from "@/lib/connectors/common";

/** Colonne/propriété disponible côté source. `hint` = type (Notion). */
export interface SourceColumn {
  value: string;
  label: string;
}

const FIELD_LABELS: Record<(typeof PROSPECT_FIELDS)[number], string> = {
  name: "Nom",
  email: "Email",
  company: "Entreprise",
  stage: "Statut",
};

const SELECT =
  "w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";

/** Écran de correspondance : relie les colonnes de la source aux champs Nepteo.
 *  Valeurs pré-remplies = mapping enregistré, ou détection auto. « — (aucune) »
 *  enregistre le champ à null (absent de la base). */
export function ColumnMapping({
  provider,
  action,
  columns,
  mapping,
  canEdit,
}: {
  provider: string;
  action: (formData: FormData) => void | Promise<void>;
  columns: SourceColumn[];
  mapping: FieldMapping;
  canEdit: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="provider" value={provider} />
      <p className="mb-3 text-[12.5px] text-muted">
        Reliez vos colonnes aux champs Nepteo. La détection automatique est
        pré-remplie — corrigez si besoin.
      </p>
      <div className="space-y-2.5">
        {PROSPECT_FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-3">
            <span className="w-24 flex-none text-[13px] font-medium text-ink">
              {FIELD_LABELS[field]}
            </span>
            <select
              name={field}
              defaultValue={mapping[field] ?? ""}
              disabled={!canEdit}
              className={SELECT}
            >
              <option value="">— (aucune)</option>
              {columns.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {canEdit && (
        <button type="submit" className={`${SAVE_BTN} mt-4`}>
          Enregistrer la correspondance
        </button>
      )}
    </form>
  );
}
