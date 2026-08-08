import Link from "next/link";
import { connectorCapability, type CatalogTool } from "@/lib/connectors";
import {
  isImportProvider,
  isOauthProvider,
} from "@/lib/connectors/common";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import { requestConnector } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  crm: "Prospects & clients",
  analytics: "Visiteurs",
  ads: "Publicité",
  email: "Communication",
  payments: "Ventes & revenus",
  files: "Contenus & documents",
};

export type ConnectorStatus =
  | "connected"
  | "configured"
  | "paused"
  | "error"
  | "requested"
  | "available";

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
  const capability = connectorCapability(tool.provider);
  const isOauth = capability?.activation === "oauth";
  const isImport = capability?.activation === "import";
  const isProposal = capability?.activation === "proposal";

  return (
    <div
      className={`flex flex-col rounded-[13px] border bg-white p-4 shadow-card ${
        status === "connected"
          ? "border-green/40"
          : status === "error"
            ? "border-red/40"
            : "border-line-soft"
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
      {status === "available" && (
        <p className="mt-2 text-[11.5px] font-medium text-muted">
          {isOauth
            ? "Connexion OAuth disponible"
            : isImport
              ? "Import disponible"
              : "Intégration proposée — non connectée"}
        </p>
      )}
      {status === "configured" && (
        <p className="mt-2 text-[11.5px] font-medium text-amber">
          Accès autorisé — source à vérifier
        </p>
      )}
      {status === "paused" && (
        <p className="mt-2 text-[11.5px] font-medium text-amber">
          Lecture en pause — aucune synchronisation
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-[11.5px] font-medium text-red">
          Dernière lecture en erreur — vérification requise
        </p>
      )}
      <div className="mt-3.5">
        {status === "connected" && (
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-green">
              <i className="h-[7px] w-[7px] rounded-full bg-green" />
              {isImportProvider(tool.provider) ? "Importé" : "Connecté"}
            </span>
            {(isOauthProvider(tool.provider) ||
              isImportProvider(tool.provider)) && (
              <Link
                href={`/connecteurs/${tool.provider}`}
                className="text-[12px] font-semibold text-violet hover:underline"
              >
                Gérer →
              </Link>
            )}
          </span>
        )}
        {status !== "connected" && isOauthProvider(tool.provider) && canEdit && (
          status === "available" ? (
            <a
              href={`/api/connectors/${tool.provider}/authorize`}
              className="inline-block rounded-[7px] bg-tint px-3.5 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
            >
              Connecter via OAuth
            </a>
          ) : (
            <Link
              href={`/connecteurs/${tool.provider}`}
              className="inline-block rounded-[7px] bg-tint px-3.5 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
            >
              {status === "configured" ? "Configurer la source" : "Gérer"}
            </Link>
          )
        )}
        {status === "available" &&
          isOauthProvider(tool.provider) &&
          !canEdit &&
          blockedByDemo && (
            <span className="text-[12px] font-medium text-amber">
              {demoPresentation === "certified-demo"
                ? "Scénario d'exemple Nepteo — connexion externe désactivée."
                : "Environnement de test — connexion externe désactivée tant que l'état du scénario Nepteo n'est pas clarifié."}
            </span>
          )}
        {status === "available" &&
          isImport &&
          canEdit && (
            <Link
              href={`/connecteurs/${tool.provider}`}
              className="inline-block rounded-[7px] bg-tint px-3.5 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
            >
              Importer
            </Link>
          )}
        {status === "available" &&
          isImport &&
          !canEdit &&
          blockedByDemo && (
            <span className="text-[12px] font-medium text-amber">
              Retirez d&apos;abord le scénario Nepteo pour importer ce fichier.
            </span>
          )}
        {status === "requested" && isProposal && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber">
            <i className="h-[7px] w-[7px] rounded-full bg-amber" />
            {justRequested
              ? "Demande enregistrée — non connectée"
              : "Demande en attente — non connectée"}
          </span>
        )}
        {status === "available" &&
          isProposal &&
          (canEdit ? (
            <form action={requestConnector}>
              <input type="hidden" name="provider" value={tool.provider} />
              <button
                type="submit"
                className="rounded-[7px] bg-tint px-3.5 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
              >
                Demander l&apos;intégration
              </button>
            </form>
          ) : (
            <span className="text-[12px] text-faint">
              Intégration proposée — demande par un administrateur
            </span>
          ))}
      </div>
    </div>
  );
}
