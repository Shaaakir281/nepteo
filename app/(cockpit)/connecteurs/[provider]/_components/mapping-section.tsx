import type { FieldMapping } from "@/lib/connectors/common";
import { ColumnMapping } from "./column-mapping";
import type {
  RemoteColumn,
  RemoteListState,
} from "../_lib/detail-rules";
import { saveFieldMapping } from "../actions";

export function MappingSection({
  provider,
  state,
  mapping,
  canEdit,
}: {
  provider: "google_sheets" | "notion";
  state: RemoteListState<RemoteColumn> | null;
  mapping: FieldMapping;
  canEdit: boolean;
}) {
  if (!state) return null;

  return (
    <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
      <div className="border-b border-line-soft px-[22px] py-4">
        <h3 className="font-display text-[15px] font-semibold">
          Correspondance des colonnes
        </h3>
      </div>
      <div className="p-[22px]">
        {state.status === "error" ? (
          <p className="rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] text-red">
            {state.message}
          </p>
        ) : state.status === "empty" ? (
          <p className="text-[13px] text-muted">
            La source est accessible, mais aucune colonne exploitable n&apos;a
            été trouvée.
          </p>
        ) : (
          <ColumnMapping
            provider={provider}
            action={saveFieldMapping}
            columns={state.items}
            mapping={mapping}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
