"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearDemoAction, loadDemoScenarioAction } from "../actions";

/**
 * Mode démonstration : charge une entreprise fictive complète (identité,
 * prospects, campagnes, ventes) en un clic. Les trois scénarios sont
 * volontairement contrastés — l'agent doit s'adapter au métier, c'est ce
 * qu'on montre. Aucune donnée réelle n'est touchée.
 */

export interface ScenarioChoice {
  id: string;
  label: string;
  pitch: string;
}

const STEPS = [
  "Remise à zéro du cockpit…",
  "Installation de l'identité…",
  "Import de la base de prospects…",
  "Chargement des campagnes et des ventes…",
  "Analyse et rédaction des propositions…",
];
const STEP_MS = 700;

/**
 * Un retrait qui échoue peut laisser des données fictives en base : le dire,
 * plutôt que d'afficher « Réessayez » comme pour un chargement.
 *
 * Une session expirée et une erreur de base ne se réparent pas pareil : on ne
 * renvoie donc pas le même conseil pour les deux.
 */
function failureMessage(id: string, reason?: string): string {
  if (reason === "forbidden") {
    return "Action refusée : le mode démonstration est réservé aux administrateurs.";
  }
  if (reason === "unsafe_existing_data") {
    return "Chargement refusé pour protéger vos données existantes. Utilisez une organisation de test vide.";
  }
  if (reason === "busy") {
    return "Une autre opération de démonstration est en cours. Attendez sa fin, puis réessayez.";
  }
  return id === "clear"
    ? "Le retrait n'a pas abouti — des données de démonstration sont peut-être encore là, et votre fiche entreprise n'a pas été restaurée. Réessayez."
    : "Le chargement n'a pas abouti. Réessayez.";
}

export function DemoPanel({
  scenarios,
  canManageDemo,
}: {
  scenarios: ScenarioChoice[];
  canManageDemo: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "warning">(
    "success",
  );
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  async function run(
    id: string,
    task: () => Promise<{
      ok: boolean;
      created?: number;
      analysis?: {
        prospects: { ok: boolean; created: number; detail?: string };
        campaigns: { ok: boolean; created: number; detail?: string };
      };
      reason?: string;
      detail?: string;
    }>,
  ) {
    if (busy) return;
    setBusy(id);
    setMessage(null);
    setMessageTone("success");
    setError(null);
    setDetail(null);
    setStep(0);

    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + 1, STEPS.length - 1);
      setStep(current);
    }, STEP_MS);

    try {
      const [result] = await Promise.all([
        task(),
        new Promise((r) => setTimeout(r, STEPS.length * STEP_MS)),
      ]);
      if (result.ok) {
        const created = result.created ?? 0;
        const failedAnalyses = result.analysis
          ? Object.entries(result.analysis).filter(([, value]) => !value.ok)
          : [];
        if (id !== "clear" && failedAnalyses.length > 0) {
          const labels = failedAnalyses.map(([key]) =>
            key === "prospects" ? "prospects" : "campagnes",
          );
          setMessageTone("warning");
          setMessage(
            `Scénario chargé — ${
              created > 0
                ? `${created} proposition${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}`
                : "aucune proposition créée"
            }. Analyse à relancer : ${labels.join(" et ")}.`,
          );
          setDetail(
            failedAnalyses
              .map(([key, value]) => `${key}: ${value.detail ?? "échec inconnu"}`)
              .join(" · "),
          );
        } else {
          setMessage(
            id === "clear"
              ? "Données de démonstration retirées."
              : created > 0
                ? `Scénario chargé et analysé — ${created} proposition${created > 1 ? "s" : ""} en attente sur « Aujourd'hui ».`
                : "Scénario chargé. L'analyse n'a rien trouvé à proposer cette fois.",
          );
        }
      } else {
        setError(failureMessage(id, result.reason));
        setDetail(result.detail ?? null);
      }
    } catch (err) {
      setError(failureMessage(id));
      setDetail(err instanceof Error ? err.message : null);
    } finally {
      clearInterval(timer);
      setBusy(null);
      router.refresh();
    }
  }

  if (!canManageDemo) {
    return (
      <p className="text-[13px] text-muted">
        Le chargement et le retrait des données de démonstration sont réservés
        aux administrateurs.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 rounded-[10px] bg-tint-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-body">
        Votre fiche entreprise sera remplacée le temps de la démonstration, puis
        restaurée quand vous retirerez les données. Le chargement est refusé si
        l&apos;organisation contient déjà des données ou connecteurs réels.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className="flex flex-col rounded-[13px] border border-line-soft bg-tint-soft/40 p-4"
          >
            <h4 className="font-display text-[13.5px] font-semibold text-ink">
              {s.label}
            </h4>
            <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">
              {s.pitch}
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run(s.id, () => loadDemoScenarioAction(s.id))}
              className="mt-3 rounded-[10px] bg-violet px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === s.id ? "Chargement…" : "Charger et analyser"}
            </button>
          </div>
        ))}
      </div>

      {busy && (
        <div className="mt-4 flex items-center gap-2.5 text-[13px] font-medium text-violet">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet border-t-transparent" />
          <span>{STEPS[step]}</span>
        </div>
      )}
      {message && (
        <div
          className={`mt-4 rounded-[10px] px-3.5 py-2.5 ${
            messageTone === "warning"
              ? "bg-amber-tint text-amber"
              : "bg-green-tint text-green"
          }`}
        >
          <p className="text-[13px] font-medium">{message}</p>
          {messageTone === "warning" && detail && (
            <p className="mt-1 text-[11.5px] leading-relaxed opacity-80">
              Détail : {detail}
            </p>
          )}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-[10px] bg-red-tint px-3.5 py-2.5">
          <p className="text-[13px] font-medium text-red">{error}</p>
          {detail && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-red/80">
              Détail : {detail}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        <p className="max-w-xl text-[11.5px] leading-relaxed text-faint">
          Entreprises fictives. Utilisez une organisation de test dédiée et
          vide. Changer de scénario retire uniquement l&apos;état marqué comme
          démonstration, puis relance l&apos;analyse.
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("clear", clearDemoAction)}
          className="text-[12px] font-semibold text-muted hover:text-ink hover:underline disabled:opacity-40"
        >
          Retirer les données de démonstration
        </button>
      </div>
    </div>
  );
}
