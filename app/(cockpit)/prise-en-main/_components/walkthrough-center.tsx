"use client";

import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { WalkthroughContextCompletion } from "@/lib/memory-completion";
import {
  WALKTHROUGH_STAGES,
  walkthroughRequiredMissionsComplete,
  type WalkthroughPath,
  type WalkthroughScenario,
} from "@/lib/onboarding/walkthrough";
import { useWalkthroughProgress } from "./use-walkthrough-progress";
import { WalkthroughHero } from "./walkthrough-hero";
import { WalkthroughStageList } from "./walkthrough-stage-list";

const SCENARIO_LABELS: Record<WalkthroughScenario, string> = {
  artisan: "Menuiserie Dubreuil",
  agence: "Atelier Northwind",
  ecommerce: "Racines & Co",
};

export function WalkthroughCenter({
  initialPath,
  initialScenario,
  demoPresentation,
  organizationName,
  canManageDemo,
  contextCompletion,
}: {
  initialPath?: WalkthroughPath;
  initialScenario?: WalkthroughScenario;
  demoPresentation: DemoPresentation;
  organizationName: string;
  canManageDemo: boolean;
  contextCompletion: WalkthroughContextCompletion;
}) {
  const { state, currentMission, loadingSkipped, launch, skip, reset } =
    useWalkthroughProgress({ initialPath, initialScenario, contextCompletion });

  const selectedScenario = state.scenario ?? "artisan";
  const exampleNeedsLoading =
    state.path === "example" && demoPresentation !== "certified-demo";
  const showLoadingMission = exampleNeedsLoading && !loadingSkipped;
  const currentStage = currentMission?.stage ?? WALKTHROUGH_STAGES.length - 1;
  const stage = WALKTHROUGH_STAGES[showLoadingMission ? 0 : currentStage];
  const connectUnlocked = walkthroughRequiredMissionsComplete(state);

  const chip =
    state.path === "example"
      ? SCENARIO_LABELS[selectedScenario]
      : state.path === "real"
        ? organizationName
        : "Exploration libre";
  const hero = showLoadingMission
    ? {
        title: `Chargez ${SCENARIO_LABELS[selectedScenario]}.`,
        goal: "Le scénario reste distinct et ne se charge qu’après votre geste explicite.",
        action: "Charger ce scénario",
        href: `/entreprise?onglet=connecteurs&prise_en_main=1&scenario=${selectedScenario}`,
        canAct: canManageDemo,
        unavailableLabel: "Un administrateur doit charger le scénario.",
      }
    : currentMission
      ? { ...currentMission, canAct: true, unavailableLabel: undefined }
      : {
          title: "Guide terminé.",
          goal: "Les cinq étapes essentielles sont terminées.",
          action: "",
          href: "/prise-en-main",
          canAct: false,
          unavailableLabel: "Les cinq étapes sont terminées.",
        };

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[20px] font-semibold text-ink">Guide</h1>
        <span className="rounded-full border border-line-soft bg-white px-3 py-1.5 text-[11px] font-semibold text-muted shadow-card">
          {chip}
        </span>
      </header>
      <WalkthroughHero
        stage={(showLoadingMission ? 0 : currentStage) + 1}
        stageTitle={stage.title}
        title={hero.title}
        goal={hero.goal}
        action={hero.action}
        href={hero.href}
        canAct={hero.canAct}
        unavailableLabel={hero.unavailableLabel}
        onLaunch={() => launch(showLoadingMission)}
        onSkip={() => skip(showLoadingMission)}
      />
      <WalkthroughStageList
        state={state}
        currentStage={showLoadingMission ? 0 : currentStage}
        connectUnlocked={connectUnlocked}
      />
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-[11px] text-faint">
        <span>Progression locale à ce navigateur.</span>
        <button
          type="button"
          onClick={reset}
          className="underline-offset-4 hover:text-ink hover:underline"
        >
          Réinitialiser la progression
        </button>
      </footer>
    </>
  );
}
