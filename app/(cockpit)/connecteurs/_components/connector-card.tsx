import type { CatalogTool } from "@/lib/connectors";
import { requestConnector } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  crm: "Prospects & clients",
  analytics: "Visiteurs",
  ads: "Publicité",
  email: "Communication",
  payments: "Ventes & revenus",
  files: "Contenus & documents",
};

export type ConnectorStatus = "connected" | "requested" | "available";

export function ConnectorCard({
  tool,
  status,
  canEdit,
  justRequested,
}: {
  tool: CatalogTool;
  status: ConnectorStatus;
  canEdit: boolean;
  justRequested?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-[13px] border bg-white p-4 shadow-card ${
        status === "connected" ? "border-green/40" : "border-line-soft"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-[9px] text-[13px] font-bold"
          style={{
            background: tool.color,
            color: tool.darkText ? "#1a1a2e" : "#fff",
          }}
        >
          {tool.letter}
        </span>
        <div className="min-w-0">
          <h4 className="truncate font-display text-[14px] font-semibold">
            {tool.name}
          </h4>
          <p className="text-[11.5px] text-muted">{TYPE_LABELS[tool.type]}</p>
        </div>
      </div>
      <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-body">
        {tool.description}
      </p>
      <div className="mt-3.5">
        {status === "connected" && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-green">
            <i className="h-[7px] w-[7px] rounded-full bg-green" />
            Connecté
          </span>
        )}
        {status === "requested" && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber">
            <i className="h-[7px] w-[7px] rounded-full bg-amber" />
            {justRequested ? "Demande enregistrée ✓" : "Demandé — bientôt disponible"}
          </span>
        )}
        {status === "available" &&
          (canEdit ? (
            <form action={requestConnector}>
              <input type="hidden" name="provider" value={tool.provider} />
              <button
                type="submit"
                className="rounded-[7px] bg-tint px-3.5 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
              >
                Connecter
              </button>
            </form>
          ) : (
            <span className="text-[12px] text-faint">Disponible bientôt</span>
          ))}
      </div>
    </div>
  );
}
