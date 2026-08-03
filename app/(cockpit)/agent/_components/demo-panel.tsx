"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearDemoAction, loadDemoScenarioAction } from "../actions";

/**
 * Charge un scénario d'exemple complet (identité, prospects, campagnes,
 * ventes) en un clic. Les trois scénarios sont volontairement contrastés :
 * l'agent doit s'adapter au métier. Les données apportées par le testeur ne
 * sont jamais supprimées pour installer un scénario.
 */

export interface ScenarioChoice {
  id: string;
  label: string;
  pitch: string;
}

export interface DemoLoadGuardView {
  canLoad: boolean;
  checkFailed: boolean;
  requiresDemoRemoval: boolean;
  categories: string[];
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
 * Un retrait qui échoue peut laisser des éléments du scénario en base : le
 * dire, plutôt que d'afficher « Réessayez » comme pour un chargement.
 *
 * Une session expirée et une erreur de base ne se réparent pas pareil : on ne
 * renvoie donc pas le même conseil pour les deux.
 */
function failureMessage(id: string, reason?: string): string {
  if (reason === "forbidden") {
    return "Action refusée : la gestion des scénarios d'exemple est réservée aux administrateurs.";
  }
  if (reason === "unsafe_existing_data") {
    return "Chargement refusé pour protéger les données déjà présentes. Utilisez une autre organisation de test, dédiée et vide.";
  }
  if (reason === "busy") {
    return "Une autre opération de scénario est en cours. Attendez sa fin, puis réessayez.";
  }
  return id === "clear"
    ? "Le retrait n'a pas abouti — le scénario peut être encore partiellement présent et votre fiche entreprise ne pas avoir été restaurée. Réessayez."
    : "Le chargement n'a pas abouti. Réessayez.";
}

export function DemoPanel({
  scenarios,
  canManageDemo,
  hasDemoMarker,
  loadGuard,
  guided = false,
}: {
  scenarios: ScenarioChoice[];
  canManageDemo: boolean;
  hasDemoMarker: boolean;
  loadGuard: DemoLoadGuardView;
  guided?: boolean;
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
  const [runtimeLoadBlock, setRuntimeLoadBlock] = useState<string[] | null>(
    null,
  );
  const [showWalkthroughResume, setShowWalkthroughResume] = useState(false);

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
      categories?: string[];
    }>,
  ) {
    if (busy) return;
    setBusy(id);
    setMessage(null);
    setMessageTone("success");
    setError(null);
    setDetail(null);
    setStep(0);
    setShowWalkthroughResume(false);

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
        setShowWalkthroughResume(guided && id !== "clear");
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
              ? "Scénario Nepteo retiré."
              : created > 0
                ? `Scénario chargé et analysé — ${created} proposition${created > 1 ? "s" : ""} en attente sur « Aujourd'hui ».`
                : "Scénario chargé. L'analyse n'a rien trouvé à proposer cette fois.",
          );
        }
      } else {
        if (id !== "clear" && result.reason === "unsafe_existing_data") {
          // Le préflight serveur reste l'autorité. Si l'organisation a changé
          // depuis le rendu RSC, on verrouille immédiatement les trois CTA sans
          // attendre que le rafraîchissement réseau aboutisse.
          setRuntimeLoadBlock(result.categories ?? []);
        }
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
        Le chargement et le retrait des scénarios d&apos;exemple sont réservés
        aux administrateurs.
      </p>
    );
  }

  const canLoad = loadGuard.canLoad && runtimeLoadBlock === null;
  const blockedCategories = runtimeLoadBlock ?? loadGuard.categories;

  return (
    <div>
      <p className="mb-3 rounded-[10px] bg-tint-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-body">
        {scenarios.length === 1
          ? "Ce scénario contient uniquement des données d’exemple."
          : "Les trois scénarios contiennent uniquement des données d’exemple."}{" "}
        Votre fiche entreprise sera remplacée pendant le scénario, puis
        restaurée à son retrait. Le chargement est désactivé dès que
        l&apos;organisation contient des données ou outils apportés par le
        testeur.
      </p>
      {!canLoad && (
        <div
          id="demo-load-block"
          role="status"
          className="mb-3 rounded-[10px] bg-amber-tint px-3.5 py-2.5 text-[12.5px] leading-relaxed text-body"
        >
          <p className="font-semibold">
            {loadGuard.checkFailed
              ? "État de l'organisation non vérifiable."
              : loadGuard.requiresDemoRemoval
                ? "Retirez l'ancien scénario avant de continuer."
                : "Scénarios d'exemple indisponibles dans cette organisation."}
          </p>
          {runtimeLoadBlock !== null && loadGuard.canLoad && (
            <p className="mt-1">
              L&apos;organisation a changé depuis l&apos;ouverture de cette
              page. Nepteo a bloqué le chargement avant toute modification.
            </p>
          )}
          {loadGuard.checkFailed && (
            <p className="mt-1">
              Nepteo n&apos;a pas pu vérifier complètement cette organisation.
              Actualisez la page ; les scénarios restent bloqués par précaution.
            </p>
          )}
          {loadGuard.requiresDemoRemoval && (
            <p className="mt-1">
              <b>Ancien marqueur de scénario détecté.</b> Retirez d&apos;abord
              l&apos;ancien scénario avec le bouton ci-dessous, puis rechargez
              cette page avant de choisir un scénario V2.
            </p>
          )}
          {blockedCategories.length > 0 && (
            <p className="mt-1">
              <b>Données ou outils déjà présents à préserver :</b>{" "}
              {blockedCategories.join(", ")}. Nepteo ne les supprimera pas.
              Utilisez une autre organisation vide dédiée aux scénarios
              d&apos;exemple.
            </p>
          )}
          {loadGuard.requiresDemoRemoval &&
            blockedCategories.length > 0 && (
              <p className="mt-1 font-medium">
                Retirer l&apos;ancien scénario ne suffira donc pas à débloquer
                le chargement tant que ces éléments resteront présents.
              </p>
            )}
        </div>
      )}
      <div className={`grid gap-3 ${scenarios.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
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
              disabled={busy !== null || !canLoad}
              aria-describedby={
                canLoad ? undefined : "demo-load-block"
              }
              onClick={() => run(s.id, () => loadDemoScenarioAction(s.id))}
              className="mt-3 rounded-[10px] bg-violet px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === s.id
                ? "Chargement…"
                : canLoad
                  ? "Charger et analyser"
                  : "Indisponible ici"}
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
      {showWalkthroughResume && (
        <Link
          href="/prise-en-main"
          className="mt-3 inline-flex rounded-[9px] bg-ink px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
        >
          Reprendre la prise en main →
        </Link>
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
          Scénarios de test préchargés avec des données d&apos;exemple.{" "}
          {canLoad
            ? "Changer de scénario retire uniquement le scénario actif, puis relance l'analyse."
            : hasDemoMarker
              ? "Le retrait vise uniquement les éléments marqués par le scénario ; les données apportées par le testeur sont préservées."
              : "Les données et outils déjà présents restent dans cette organisation."}
        </p>
        {hasDemoMarker && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("clear", clearDemoAction)}
            className="text-[12px] font-semibold text-muted hover:text-ink hover:underline disabled:opacity-40"
          >
            {loadGuard.requiresDemoRemoval
              ? "Retirer l'ancien scénario"
              : "Retirer le scénario Nepteo"}
          </button>
        )}
      </div>
    </div>
  );
}
