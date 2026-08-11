import { DEMO_PROVIDER } from "@/lib/demo/isolation-rules";
import type { CampaignOperationalSummary } from "../_components/campaign-decision-types";
import { CONNECTOR_ROW_LIMIT } from "./campaign-page-constants";
import { formatDateTime } from "./campaign-formatters";
import { completeRead, isRecord } from "./campaign-read-utils";

type CountedReadResult = {
  data: unknown[] | null;
  error: unknown;
  count: number | null;
};

export function presentOperationalSummary(
  agentControlResult: CountedReadResult,
  connectorsResult: CountedReadResult,
  analysisJournalResult: Omit<CountedReadResult, "count">,
): CampaignOperationalSummary {
  const unavailable = (label: string, detail: string) => ({
    state: "unavailable" as const,
    label,
    value: "Indisponible",
    detail,
  });

  let agent: CampaignOperationalSummary["agent"] = unavailable(
    "État agent",
    "Le contrôle persistant de l’organisation n’a pas pu être relu intégralement.",
  );
  if (completeRead(agentControlResult, 1) && agentControlResult.count === 1) {
    const row = agentControlResult.data[0];
    if (
      isRecord(row) &&
      typeof row.execution_paused === "boolean" &&
      (row.autonomy_level === "suggest" || row.autonomy_level === "prepare")
    ) {
      agent = {
        state: "available",
        label: "État agent",
        value: row.execution_paused
          ? "Contrôle d’exécution suspendu"
          : "Contrôle d’exécution non suspendu",
        detail: `Autonomie persistée : ${
          row.autonomy_level === "suggest"
            ? "suggestion uniquement"
            : "préparation"
        }. Ce contrôle ne prouve aucune activité et ne rend pas CAMP-2 exécutable.`,
      };
    }
  }

  let connectors: CampaignOperationalSummary["connectors"] = unavailable(
    "Connecteurs du tenant",
    "Le nombre exact n’est pas affiché car la lecture a échoué ou dépasse la borne autorisée.",
  );
  if (
    completeRead(connectorsResult, CONNECTOR_ROW_LIMIT) &&
    connectorsResult.data.every(
      (row) =>
        isRecord(row) &&
        typeof row.provider === "string" &&
        row.provider !== DEMO_PROVIDER &&
        (row.status === "connected" ||
          row.status === "disconnected" ||
          row.status === "error"),
    )
  ) {
    const connected = connectorsResult.data.filter(
      (row) => isRecord(row) && row.status === "connected",
    ).length;
    const errors = connectorsResult.data.filter(
      (row) => isRecord(row) && row.status === "error",
    ).length;
    const total = connectorsResult.count;
    connectors = {
      state: "available",
      label: "Connecteurs du tenant",
      value: `${total} hors scénario enregistré${total === 1 ? "" : "s"}`,
      detail: `${connected} connecté${connected > 1 ? "s" : ""} · ${errors} en erreur · connecteur de scénario exclu · lecture complète bornée à ${CONNECTOR_ROW_LIMIT} lignes.`,
    };
  }

  let lastAnalysis: CampaignOperationalSummary["lastAnalysis"] = unavailable(
    "Dernière analyse journalisée",
    "Le journal n’a pas pu être relu ; aucune date n’est supposée.",
  );
  if (
    analysisJournalResult.error === null &&
    Array.isArray(analysisJournalResult.data) &&
    analysisJournalResult.data.length <= 1
  ) {
    const row = analysisJournalResult.data[0];
    if (row === undefined) {
      lastAnalysis = {
        state: "available",
        label: "Dernière analyse journalisée",
        value: "Aucune trace enregistrée",
        detail: "Aucun événement analysis_run n’est présent pour cette organisation.",
      };
    } else if (
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.created_at === "string" &&
      !Number.isNaN(new Date(row.created_at).getTime()) &&
      (row.actor === "agent" || row.actor === "user")
    ) {
      lastAnalysis = {
        state: "available",
        label: "Dernière analyse journalisée",
        value: formatDateTime(row.created_at),
        detail: `Événement analysis_run · acteur ${
          row.actor === "agent" ? "agent" : "utilisateur"
        }. Cette trace indique un démarrage, pas sa réussite.`,
      };
    }
  }

  return { agent, connectors, lastAnalysis };
}
