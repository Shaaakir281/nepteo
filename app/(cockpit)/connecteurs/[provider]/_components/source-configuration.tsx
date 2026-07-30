import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import {
  encodeNotionDatabaseChoice,
  type NotionDatabaseOption,
  type RemoteListState,
} from "../_lib/detail-rules";
import { saveNotionDatabase, saveSheetConfig } from "../actions";

export function SourceConfiguration({
  provider,
  config,
  canEdit,
  databases,
}: {
  provider: "google_sheets" | "notion";
  config: Record<string, unknown>;
  canEdit: boolean;
  databases: RemoteListState<NotionDatabaseOption> | null;
}) {
  return (
    <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
      <div className="border-b border-line-soft px-[22px] py-4">
        <h3 className="font-display text-[15px] font-semibold">
          {provider === "google_sheets"
            ? "Classeur à lire"
            : "Base de données à lire"}
        </h3>
      </div>
      <div className="p-[22px]">
        {provider === "google_sheets" ? (
          <form action={saveSheetConfig}>
            <p className="mb-2 text-[12.5px] text-muted">
              Collez l&apos;URL de votre feuille de contacts. Première ligne =
              en-têtes (nom, email, entreprise, statut — détectés
              automatiquement).
            </p>
            <input
              name="url"
              required
              defaultValue={(config.spreadsheet_id as string) ?? ""}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className={FIELD}
            />
            {canEdit && (
              <button type="submit" className={`${SAVE_BTN} mt-3`}>
                Enregistrer
              </button>
            )}
          </form>
        ) : (
          <form action={saveNotionDatabase}>
            <p className="mb-2 text-[12.5px] text-muted">
              Choisissez la base partagée avec Nepteo qui contient vos contacts.
            </p>

            {!databases ? (
              <p className="text-[13px] text-muted">
                Votre rôle permet de consulter la configuration, mais pas de
                charger les bases disponibles.
              </p>
            ) : databases.status === "error" ? (
              <p className="rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] text-red">
                {databases.message}
              </p>
            ) : databases.status === "empty" ? (
              <p className="text-[13px] text-muted">
                Aucune base visible — partagez une base avec l&apos;intégration
                Nepteo dans Notion, puis rechargez.
              </p>
            ) : (
              <div className="space-y-2">
                {databases.items.map((database) => (
                  <label
                    key={database.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] font-medium text-ink has-[:checked]:border-violet has-[:checked]:bg-tint-soft"
                  >
                    <input
                      type="radio"
                      name="database_choice"
                      value={encodeNotionDatabaseChoice(database)}
                      defaultChecked={config.database_id === database.id}
                      required
                      className="accent-violet"
                    />
                    {database.title}
                  </label>
                ))}
              </div>
            )}

            {canEdit && databases?.status === "success" && (
              <button type="submit" className={`${SAVE_BTN} mt-3`}>
                Enregistrer
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
