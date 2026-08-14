"use client";

import Link from "next/link";
import { connectorCapability, type CatalogTool } from "@/lib/connectors";
import { isImportProvider, isOauthProvider } from "@/lib/connectors/common";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import { requestConnector } from "../actions";

export type ConnectorStatus =
  | "connected"
  | "configured"
  | "paused"
  | "error"
  | "requested"
  | "available";

const STATUS_COPY: Record<ConnectorStatus, { short: string; long: string; tone: string }> = {
  connected: { short: "Branché", long: "Connecté — dernière lecture vérifiée", tone: "bg-green-tint text-green" },
  configured: { short: "À vérifier", long: "Accès autorisé — source à vérifier", tone: "bg-amber-tint text-amber" },
  paused: { short: "En pause", long: "Lecture en pause — aucune synchronisation", tone: "bg-amber-tint text-amber" },
  error: { short: "Erreur", long: "Dernière lecture en erreur — vérification requise", tone: "bg-red-tint text-red" },
  requested: { short: "Prévu", long: "Demande en attente — non connectée", tone: "bg-tint-soft text-muted" },
  available: { short: "Disponible", long: "Parcours réel disponible — aucune connexion ouverte", tone: "bg-tint text-violet-ink" },
};

export function ConnectorCard({
  tool,
  status,
  canEdit,
  blockedByDemo,
  demoPresentation = "test-environment",
  justRequested,
}: {
  tool: CatalogTool;
  status: ConnectorStatus;
  canEdit: boolean;
  blockedByDemo?: boolean;
  demoPresentation?: DemoPresentation;
  justRequested?: boolean;
}) {
  const activation = connectorCapability(tool.provider)?.activation;
  const copy = status === "available" && activation === "proposal"
    ? STATUS_COPY.requested
    : STATUS_COPY[status];
  const detailsHref = `/connecteurs/${tool.provider}`;
  const connected = status === "connected";

  return (
    <div
      className="flex min-h-14 items-center gap-3 rounded-[11px] border border-line-soft bg-white px-3 py-2 shadow-card"
      title={`${tool.description} — ${copy.long}`}
    >
      <span
        className="grid h-8 w-8 flex-none place-items-center rounded-[8px] text-[11px] font-bold"
        style={{ background: tool.color, color: tool.darkText ? "#1a1a2e" : "#fff" }}
      >
        {tool.letter}
      </span>
      <b className="min-w-0 flex-1 truncate text-[13px] text-ink">{tool.name}</b>
      <span className={`flex-none rounded-full px-2 py-1 text-[10.5px] font-semibold ${copy.tone}`}>
        {status === "requested" && justRequested ? "Prévu" : copy.short}
      </span>

      {connected && (isOauthProvider(tool.provider) || isImportProvider(tool.provider)) && (
        <Link href={detailsHref} className="text-[11.5px] font-semibold text-violet hover:underline">
          Gérer
        </Link>
      )}
      {!connected && activation === "oauth" && canEdit && (
        status === "available" ? (
          tool.provider === "meta_ads" ? (
            <Link href={detailsHref} className="text-[11.5px] font-semibold text-violet hover:underline">
              Connecter
            </Link>
          ) : (
            <a href={`/api/connectors/${tool.provider}/authorize`} className="text-[11.5px] font-semibold text-violet hover:underline">
              Connecter via OAuth
            </a>
          )
        ) : (
          <Link href={detailsHref} className="text-[11.5px] font-semibold text-violet hover:underline">
            {status === "configured" ? "Configurer la source" : "Gérer"}
          </Link>
        )
      )}
      {status === "available" && activation === "import" && canEdit && (
        <Link href={detailsHref} className="text-[11.5px] font-semibold text-violet hover:underline">Importer</Link>
      )}
      {status === "available" && activation === "proposal" && canEdit && (
        <form action={requestConnector}>
          <input type="hidden" name="provider" value={tool.provider} />
          <button type="submit" className="text-[11.5px] font-semibold text-violet hover:underline">
            Demander l&apos;intégration
          </button>
        </form>
      )}
      {status === "requested" && activation === "proposal" && (
        <span className="sr-only">{justRequested ? "Demande enregistrée — non connectée" : "Demande en attente — non connectée"}</span>
      )}
      {status === "available" && !canEdit && blockedByDemo && (
        <span className="sr-only">
          {demoPresentation === "certified-demo"
            ? "Scénario d'exemple Nepteo — connexion externe désactivée."
            : "Environnement de test — connexion externe désactivée tant que l'état du scénario Nepteo n'est pas clarifié."}
        </span>
      )}
      {status === "available" && activation === "proposal" && !canEdit && !blockedByDemo && (
        <span className="sr-only">Intégration proposée — non connectée — demande par un administrateur</span>
      )}
    </div>
  );
}
