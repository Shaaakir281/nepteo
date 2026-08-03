"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import {
  CONNECT_DATA_MISSION,
  WALKTHROUGH_MISSIONS,
  WALKTHROUGH_STAGES,
  WALKTHROUGH_STORAGE_KEY,
  WALKTHROUGH_UPDATED_EVENT,
  emptyWalkthroughState,
  parseWalkthroughState,
  walkthroughCompletedCount,
  walkthroughRequiredMissionsComplete,
  type WalkthroughMission,
  type WalkthroughPath,
  type WalkthroughScenario,
  type WalkthroughState,
} from "@/lib/onboarding/walkthrough";

const SCENARIO_LABELS: Record<WalkthroughScenario, string> = {
  artisan: "Menuiserie Dubreuil",
  agence: "Atelier Northwind",
  ecommerce: "Racines & Co",
};

const PATH_LABELS: Record<WalkthroughPath, string> = {
  example: "Découverte sur données d’exemple",
  real: "Configuration de votre entreprise",
  free: "Exploration libre",
};

function writeState(next: WalkthroughState): void {
  try {
    window.localStorage.setItem(WALKTHROUGH_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WALKTHROUGH_UPDATED_EVENT));
  } catch {
    // Le parcours reste utilisable sans persistance si le stockage est bloqué.
  }
}

function MissionCard({
  mission,
  complete,
  highlighted,
  onToggle,
}: {
  mission: WalkthroughMission;
  complete: boolean;
  highlighted: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`rounded-[14px] border bg-white p-4 shadow-card transition ${
        highlighted
          ? "border-violet/50 ring-[3px] ring-violet/10"
          : complete
            ? "border-green/25"
            : "border-line-soft"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full border text-[11px] font-bold ${
            complete
              ? "border-green bg-green text-white"
              : "border-line bg-tint-soft text-muted"
          }`}
        >
          {complete ? "✓" : ""}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold text-ink">
              {mission.title}
            </h3>
            {mission.optional && (
              <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-violet-ink">
                Bêta · recommandé
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {mission.goal}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={mission.href}
              className="rounded-[9px] bg-violet px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
            >
              {mission.action}
            </Link>
            <button
              type="button"
              onClick={onToggle}
              className={`rounded-[9px] border px-3 py-2 text-[12px] font-semibold transition ${
                complete
                  ? "border-green/25 bg-green-tint text-green hover:bg-white"
                  : "border-line bg-white text-body hover:border-violet/40 hover:text-violet-ink"
              }`}
            >
              {complete ? "Étape comprise" : "Marquer comme comprise"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function WalkthroughCenter({
  initialPath,
  initialScenario,
  demoPresentation,
  organizationName,
  canManageDemo,
}: {
  initialPath?: WalkthroughPath;
  initialScenario?: WalkthroughScenario;
  demoPresentation: DemoPresentation;
  organizationName: string;
  canManageDemo: boolean;
}) {
  const [state, setState] = useState<WalkthroughState>(() =>
    emptyWalkthroughState(initialPath ?? "free", initialScenario),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored = emptyWalkthroughState();
      try {
        stored = parseWalkthroughState(
          window.localStorage.getItem(WALKTHROUGH_STORAGE_KEY),
        );
      } catch {
        // Le stockage peut être refusé par le navigateur ; le parcours reste
        // alors utilisable pour la session courante.
      }
      const pathChanged = Boolean(initialPath && initialPath !== stored.path);
      const next: WalkthroughState = {
        ...stored,
        path: initialPath ?? stored.path,
        scenario:
          initialScenario ?? (pathChanged ? undefined : stored.scenario),
        completed: pathChanged ? [] : stored.completed,
        updatedAt:
          initialPath || initialScenario
            ? new Date().toISOString()
            : stored.updatedAt,
      };
      setState(next);
      if (initialPath || initialScenario) writeState(next);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialPath, initialScenario]);

  const completedCount = walkthroughCompletedCount(state);
  const requiredComplete = walkthroughRequiredMissionsComplete(state);
  const percent = Math.round(
    (completedCount / WALKTHROUGH_MISSIONS.length) * 100,
  );
  const nextMission = WALKTHROUGH_MISSIONS.find(
    (mission) => !state.completed.includes(mission.id),
  );
  const missionsByStage = useMemo(
    () =>
      WALKTHROUGH_STAGES.map((stage) => ({
        ...stage,
        missions: WALKTHROUGH_MISSIONS.filter(
          (mission) => mission.stage === stage.id,
        ),
      })),
    [],
  );

  function updateState(
    updater: (current: WalkthroughState) => WalkthroughState,
  ) {
    setState((current) => {
      const next = { ...updater(current), updatedAt: new Date().toISOString() };
      writeState(next);
      return next;
    });
  }

  function toggleMission(id: string) {
    updateState((current) => ({
      ...current,
      completed: current.completed.includes(id)
        ? current.completed.filter((value) => value !== id)
        : [...current.completed, id],
    }));
  }

  function resetProgress() {
    if (!window.confirm("Réinitialiser uniquement la progression locale de la prise en main ?")) {
      return;
    }
    const next = emptyWalkthroughState(state.path, state.scenario);
    next.updatedAt = new Date().toISOString();
    setState(next);
    writeState(next);
  }

  const selectedScenario = state.scenario ?? "artisan";
  const exampleNeedsLoading =
    state.path === "example" && demoPresentation !== "certified-demo";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-violet">
            {PATH_LABELS[state.path]}
          </p>
          <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight">
            Prise en main
          </h1>
          <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-muted">
            Suivez le cycle réel de Nepteo : comprendre le contexte, analyser,
            examiner une priorité, décider puis contrôler. Les missions ouvrent
            les vrais écrans ; elles ne déclenchent aucune action à votre place.
          </p>
        </div>
        <button
          type="button"
          onClick={resetProgress}
          className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12px] font-semibold text-muted hover:border-violet/40 hover:text-ink"
        >
          Réinitialiser la progression
        </button>
      </div>

      <section className="mt-5 rounded-[16px] border border-line-soft bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">
              {ready ? completedCount : 0} mission
              {(ready ? completedCount : 0) > 1 ? "s" : ""} comprise
              {(ready ? completedCount : 0) > 1 ? "s" : ""} sur {WALKTHROUGH_MISSIONS.length}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Progression locale à ce navigateur, sans URL, réponse libre ni
              donnée d’entreprise.
            </p>
          </div>
          <span className="font-display text-[20px] font-semibold text-violet-ink">
            {ready ? percent : 0}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Progression de la prise en main"
          aria-valuemin={0}
          aria-valuemax={WALKTHROUGH_MISSIONS.length}
          aria-valuenow={ready ? completedCount : 0}
          className="mt-3 h-2 overflow-hidden rounded-full bg-tint"
        >
          <div
            className="h-full rounded-full bg-violet transition-[width]"
            style={{ width: `${ready ? percent : 0}%` }}
          />
        </div>
      </section>

      {state.path === "example" && (
        <section
          className={`mt-5 rounded-[14px] border px-4 py-3.5 text-[12.5px] leading-relaxed ${
            exampleNeedsLoading
              ? "border-amber/25 bg-amber-tint text-body"
              : "border-green/25 bg-green-tint text-body"
          }`}
        >
          {exampleNeedsLoading ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>Votre espace est prêt.</b> Chargez maintenant le scénario{" "}
                <b>{SCENARIO_LABELS[selectedScenario]}</b> depuis l’écran prévu
                à cet effet. Le chargement ne démarre pas automatiquement.
              </div>
              {canManageDemo ? (
                <Link
                  href={`/entreprise?onglet=connecteurs&prise_en_main=1&scenario=${selectedScenario}`}
                  className="flex-none rounded-[9px] bg-ink px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
                >
                  Charger ce scénario
                </Link>
              ) : (
                <span className="font-semibold text-amber">
                  Un administrateur doit charger le scénario.
                </span>
              )}
            </div>
          ) : (
            <p>
              <b>Scénario d’exemple actif.</b> Vous pouvez suivre les missions
              sur les données isolées de {organizationName}. Aucun compte
              externe n’est connecté par le scénario.
            </p>
          )}
        </section>
      )}

      {state.path === "real" && (
        <section className="mt-5 rounded-[14px] border border-violet/20 bg-tint px-4 py-3.5 text-[12.5px] leading-relaxed text-body">
          <b>Parcours entreprise réelle.</b> Les scénarios d’exemple restent
          séparés. L’analyse d’un site dans le laboratoire reste une proposition
          en lecture seule tant que vous ne choisissez pas explicitement les
          sections à appliquer.
        </section>
      )}

      <div className="mt-7 space-y-6">
        {missionsByStage.map((stage, index) => {
          const done = stage.missions.filter((mission) =>
            state.completed.includes(mission.id),
          ).length;
          return (
            <section key={stage.id} aria-labelledby={`walkthrough-stage-${stage.id}`}>
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
                    Étape {index + 1}
                  </p>
                  <h2
                    id={`walkthrough-stage-${stage.id}`}
                    className="mt-0.5 text-[17px] font-semibold"
                  >
                    {stage.title}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {stage.description}
                  </p>
                </div>
                <span className="flex-none rounded-full bg-tint px-2.5 py-1 text-[11px] font-semibold text-violet-ink">
                  {done} / {stage.missions.length}
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {stage.missions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    complete={state.completed.includes(mission.id)}
                    highlighted={ready && nextMission?.id === mission.id}
                    onToggle={() => toggleMission(mission.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-7 rounded-[16px] border border-line-soft bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[15px] ${
              requiredComplete
                ? "bg-green-tint text-green"
                : "bg-tint text-violet-ink"
            }`}
          >
            {requiredComplete ? "✓" : "⌁"}
          </span>
          <div className="flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
              Étape suivante
            </p>
            <h2 className="mt-1 text-[16px] font-semibold">
              {CONNECT_DATA_MISSION.title}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              {requiredComplete
                ? CONNECT_DATA_MISSION.goal
                : "Elle se débloque dans ce parcours après les dix missions essentielles. Le laboratoire web recommandé n’est pas bloquant."}
            </p>
            {requiredComplete && (
              <Link
                href={CONNECT_DATA_MISSION.href}
                className="mt-3 inline-flex rounded-[9px] bg-violet px-3 py-2 text-[12px] font-semibold text-white hover:bg-violet-deep"
              >
                {CONNECT_DATA_MISSION.action}
              </Link>
            )}
          </div>
        </div>
      </section>

      <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
        Une coche indique seulement qu’un geste a été compris dans ce navigateur.
        Elle ne certifie ni une compétence marketing, ni l’exécution d’une
        action, ni un résultat commercial.
      </p>
    </>
  );
}
