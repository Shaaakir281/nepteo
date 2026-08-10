import Link from "next/link";
import type { CatalogTool } from "@/lib/connectors";

const fmtDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function ConnectorDetailHeader({
  tool,
  presentation,
  config,
  saved,
  synced,
  error,
}: {
  tool: CatalogTool;
  presentation: string;
  config: Record<string, unknown>;
  saved?: string;
  synced?: string;
  error?: string;
}) {
  const connected = presentation === "connected";
  return (
    <>
      <Link href="/entreprise?onglet=connecteurs" className="text-[13px] text-muted hover:text-ink">← Tous les connecteurs</Link>
      <div className="mt-3 mb-5 flex items-center gap-3.5">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[11px] text-[15px] font-bold" style={{ background: tool.color, color: tool.darkText ? "#1a1a2e" : "#fff" }}>{tool.letter}</span>
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">{tool.name}</h1>
          <p className="text-[12.5px] text-muted">
            {connected ? (
              <><span className="font-semibold text-green">Connecté</span>{typeof config.workspace_name === "string" && ` · ${config.workspace_name}`}{typeof config.last_synced_at === "string" && ` · synchronisé le ${fmtDate.format(new Date(config.last_synced_at))}`}</>
            ) : presentation === "configured" ? "Accès autorisé — source à vérifier"
              : presentation === "paused" ? "Lecture en pause"
                : presentation === "error" ? "Dernière lecture en erreur" : "Non connecté"}
          </p>
        </div>
      </div>
      {error && <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">{error}</p>}
      {saved && <p className="mb-4 rounded-[10px] bg-green-tint px-4 py-2.5 text-[13px] font-medium text-green">Configuration enregistrée ✓</p>}
      {synced && <p className="mb-4 rounded-[10px] bg-green-tint px-4 py-2.5 text-[13px] font-medium text-green">Synchronisation terminée — {synced} prospect{Number(synced) > 1 ? "s" : ""} lu{Number(synced) > 1 ? "s" : ""} ✓</p>}
    </>
  );
}
