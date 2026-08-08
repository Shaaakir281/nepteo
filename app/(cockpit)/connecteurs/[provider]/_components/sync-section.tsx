import { SAVE_BTN } from "@/components/ui/styles";
import {
  disconnectConnector,
  setConnectorPause,
  syncNow,
} from "../actions";

export interface ProspectPreview {
  name: string | null;
  email: string | null;
  company: string | null;
}

export function SyncSection({
  provider,
  configured,
  paused,
  canEdit,
  prospectCount,
  preview,
}: {
  provider: "google_sheets" | "notion";
  configured: boolean;
  paused: boolean;
  canEdit: boolean;
  prospectCount: number;
  preview: ProspectPreview[];
}) {
  return (
    <>
      <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
          <h3 className="font-display text-[15px] font-semibold">
            Synchronisation
          </h3>
          <span className="text-[12px] text-muted">
            {prospectCount} prospect{prospectCount > 1 ? "s" : ""} en mémoire
          </span>
        </div>
        <div className="p-[22px]">
          {preview.length > 0 && (
            <ul className="mb-4 space-y-1.5">
              {preview.map((prospect, index) => (
                <li key={index} className="text-[13px] text-ink">
                  <b className="font-semibold">{prospect.name ?? "—"}</b>
                  {prospect.email && (
                    <span className="text-muted"> · {prospect.email}</span>
                  )}
                  {prospect.company && (
                    <span className="text-muted"> · {prospect.company}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex items-center gap-3">
              <form action={syncNow}>
                <input type="hidden" name="provider" value={provider} />
                <button
                  type="submit"
                  disabled={!configured || paused}
                  className={`${SAVE_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Synchroniser maintenant
                </button>
              </form>
              {!configured && (
                <span className="text-[12.5px] text-muted">
                  Configurez d&apos;abord la source ci-dessus.
                </span>
              )}
              {paused && (
                <span className="text-[12.5px] text-amber">
                  Lecture en pause : aucune synchronisation ne démarre.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <form action={setConnectorPause}>
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="pause" value={paused ? "false" : "true"} />
            <button
              type="submit"
              className="text-[12.5px] font-semibold text-amber hover:underline"
            >
              {paused ? "Reprendre la lecture" : "Mettre la lecture en pause"}
            </button>
          </form>
          <form action={disconnectConnector}>
            <input type="hidden" name="provider" value={provider} />
            <button
              type="submit"
              className="text-[12.5px] font-semibold text-red hover:underline"
            >
              Déconnecter et supprimer les jetons d&apos;accès
            </button>
          </form>
        </div>
      )}
    </>
  );
}
