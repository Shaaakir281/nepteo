import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CONNECT_DATA_MISSION,
  WALKTHROUGH_MISSIONS,
  WALKTHROUGH_STAGES,
  emptyWalkthroughState,
  parseWalkthroughState,
  walkthroughCompletedCount,
  walkthroughCompletedStageCount,
  walkthroughIsComplete,
  walkthroughRequiredMissionsComplete,
} from "../lib/onboarding/walkthrough.ts";
import { ONBOARDING_CHOICE_COPY } from "../app/onboarding/_components/onboarding-choice-copy.ts";

const [
  onboardingAction,
  onboardingPage,
  guidedOnboarding,
  onboardingChoice,
  onboardingExample,
  center,
  demoPanel,
  sidebar,
] =
  await Promise.all([
    readFile(new URL("../app/onboarding/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/onboarding/_components/guided-onboarding.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/onboarding/_components/onboarding-choice.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/onboarding/_components/onboarding-example.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/prise-en-main/_components/walkthrough-center.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/agent/_components/demo-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/_components/sidebar.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

test("prise en main — onze missions, cinq étapes et connexion séparée", () => {
  assert.equal(WALKTHROUGH_MISSIONS.length, 11);
  assert.equal(WALKTHROUGH_STAGES.length, 5);
  assert.equal(new Set(WALKTHROUGH_MISSIONS.map((mission) => mission.id)).size, 11);
  assert.equal(CONNECT_DATA_MISSION.id, "connect-data");
  assert.equal(
    WALKTHROUGH_MISSIONS.filter((mission) => mission.optional).map(
      (mission) => mission.id,
    ).join(","),
    "website",
  );
});

test("progression — format versionné, borné et sans contenu métier", () => {
  const state = parseWalkthroughState(
    JSON.stringify({
      version: 1,
      path: "example",
      scenario: "artisan",
      completed: ["activity", "activity", "unknown", 42],
      updatedAt: "2026-08-03T10:00:00.000Z",
      website: "https://example.test",
      freeText: "ne doit pas être repris",
    }),
  );
  assert.deepEqual(state.completed, ["activity"]);
  assert.equal(state.path, "example");
  assert.equal(state.scenario, "artisan");
  assert.equal("website" in state, false);
  assert.equal("freeText" in state, false);
  assert.equal(walkthroughCompletedCount(state), 1);
});

test("progression — état invalide ignoré et mission web non bloquante", () => {
  assert.deepEqual(parseWalkthroughState("{invalid"), emptyWalkthroughState());

  const requiredIds = WALKTHROUGH_MISSIONS.filter(
    (mission) => !mission.optional,
  ).map((mission) => mission.id);
  const state = {
    ...emptyWalkthroughState("real"),
    completed: requiredIds,
  };
  assert.equal(walkthroughRequiredMissionsComplete(state), true);
  assert.equal(walkthroughIsComplete(state), false);
  assert.equal(
    walkthroughIsComplete({ ...state, completed: WALKTHROUGH_MISSIONS.map((m) => m.id) }),
    true,
  );
});

test("progression — le compteur visible reste fondé sur cinq étapes", () => {
  const state = {
    ...emptyWalkthroughState("real"),
    completed: ["activity", "voice", "website", "situation", "summary"],
  };

  assert.equal(walkthroughCompletedCount(state), 5);
  assert.equal(walkthroughCompletedStageCount(state), 2);
  assert.equal(
    walkthroughCompletedStageCount({
      ...state,
      completed: WALKTHROUGH_MISSIONS.map((mission) => mission.id),
    }),
    WALKTHROUGH_STAGES.length,
  );
});

test("onboarding — choix explicite avant formulaire et aucune exécution automatique", () => {
  assert.match(onboardingPage, /GuidedOnboarding/);
  assert.match(guidedOnboarding, /setScreen\("example"\)/);
  assert.match(guidedOnboarding, /setScreen\("real"\)/);
  assert.match(onboardingAction, /onboardingPath: z\.enum\(\["example", "real"\]\)/);
  assert.match(onboardingAction, /\/prise-en-main\?depart=example&scenario=/);
  assert.doesNotMatch(onboardingAction, /loadDemoScenarioAction|runResearch|proposeIdentityForOrg/);
});

test("onboarding UX-5 — écran de choix épuré à 38 mots", () => {
  const visibleCopy = [
    ONBOARDING_CHOICE_COPY.title,
    ONBOARDING_CHOICE_COPY.example.title,
    ONBOARDING_CHOICE_COPY.example.description,
    ONBOARDING_CHOICE_COPY.example.duration,
    ONBOARDING_CHOICE_COPY.real.title,
    ONBOARDING_CHOICE_COPY.real.description,
    ONBOARDING_CHOICE_COPY.real.duration,
    ONBOARDING_CHOICE_COPY.safeLabel,
    ONBOARDING_CHOICE_COPY.safeDetail,
  ].join(" ");
  const words = visibleCopy.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu) ?? [];

  assert.equal(words.length, 38);
  assert.equal(ONBOARDING_CHOICE_COPY.example.duration, "3 min");
  assert.equal(ONBOARDING_CHOICE_COPY.real.duration, "5 min");
  assert.match(onboardingChoice, /icons\.sparkle/);
  assert.match(onboardingChoice, /icons\.house/);
  assert.match(onboardingChoice, /text-\[11\.5px\]/);
  assert.doesNotMatch(onboardingChoice, /Bienvenue dans Nepteo|Recommandé/);
});

test("onboarding UX-5 — scénarios illustrés et confirmation distincte", () => {
  assert.match(onboardingExample, /icons\.house/);
  assert.match(onboardingExample, /icons\.people/);
  assert.match(onboardingExample, /icons\.send/);
  assert.match(
    onboardingExample,
    /Le scénario ne se charge qu’après une confirmation explicite\./,
  );
  assert.match(onboardingExample, /name="scenario" value=\{scenario\}/);
  assert.match(onboardingExample, /<form action=\{action\}/);
  assert.doesNotMatch(onboardingExample, /loadDemoScenario|runAnalysis/);
});

test("centre — progression locale, routes réelles et reprise explicite", () => {
  assert.match(center, /WALKTHROUGH_STORAGE_KEY/);
  assert.match(center, /ne déclenchent aucune action à votre place/);
  assert.match(center, /Le chargement ne démarre pas automatiquement/);
  assert.match(center, /\/entreprise\?onglet=connecteurs&prise_en_main=1&scenario=/);
  assert.match(demoPanel, /Reprendre la prise en main/);
  assert.match(sidebar, /WalkthroughSidebarLink/);
});
