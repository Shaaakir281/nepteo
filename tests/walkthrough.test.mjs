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
  walkthroughCompletedWithContext,
  walkthroughIsComplete,
  walkthroughRequiredMissionsComplete,
} from "../lib/onboarding/walkthrough.ts";
import {
  memorySectionIsFilled,
  profileMemoryCompletion,
  walkthroughContextCompletion,
} from "../lib/memory-completion.ts";
import { ONBOARDING_CHOICE_COPY } from "../app/onboarding/_components/onboarding-choice-copy.ts";

const [
  onboardingAction,
  onboardingPage,
  guidedOnboarding,
  onboardingChoice,
  onboardingExample,
  center,
  hero,
  progressHook,
  stageList,
  walkthroughPage,
  demoPanel,
  sidebar,
  sidebarLink,
  todayProgress,
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
        "../app/(cockpit)/prise-en-main/_components/walkthrough-hero.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/prise-en-main/_components/use-walkthrough-progress.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/prise-en-main/_components/walkthrough-stage-list.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/(cockpit)/prise-en-main/page.tsx", import.meta.url),
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
    readFile(
      new URL(
        "../app/(cockpit)/_components/walkthrough-link.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/_components/walkthrough-progress.tsx",
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

test("UX-2 — le contexte exige les quatre champs nommés", () => {
  const partial = {
    activite: { activity_type: "Services" },
    zone: { text: "Dreux" },
    ton: { text: "Direct" },
    philosophie: { text: "   " },
  };
  assert.equal(memorySectionIsFilled(partial, "activite"), true);
  assert.deepEqual(walkthroughContextCompletion(partial), {
    activity: true,
    voice: false,
    complete: false,
  });
  assert.deepEqual(
    walkthroughContextCompletion({
      ...partial,
      philosophie: { text: "Promettre seulement ce qui est vérifiable." },
    }),
    { activity: true, voice: true, complete: true },
  );
});

test("UX-2 — une visite seule ne valide jamais les missions de contexte", () => {
  assert.deepEqual(
    walkthroughCompletedWithContext(
      ["activity", "voice", "situation"],
      { activity: false, voice: false },
    ),
    ["situation"],
  );
  assert.deepEqual(
    walkthroughCompletedWithContext(["situation"], {
      activity: true,
      voice: true,
    }),
    ["situation", "activity", "voice"],
  );
});

test("UX-3 — la jauge compte huit champs et mappe communication sur presence", () => {
  const memory = {
    activite: { activity_type: "Services" },
    zone: { text: "Dreux" },
    offres: { items: [{ name: "Audit" }] },
    ton: { text: "Direct" },
    philosophie: { text: "Rester concret" },
    canaux: { list: ["Google"] },
    presence: { list: ["Newsletter"] },
    objectifs: { list: ["Trouver plus de clients"] },
  };

  assert.deepEqual(profileMemoryCompletion({}), {
    completed: 0,
    total: 8,
    filled: [],
  });
  assert.deepEqual(profileMemoryCompletion(memory), {
    completed: 8,
    total: 8,
    filled: [
      "activite",
      "zone",
      "offres",
      "ton",
      "philosophie",
      "canaux",
      "communication",
      "objectifs",
    ],
  });
});

test("UX-3 — quatre champs hors contexte ne valident pas le guide", () => {
  const memory = {
    offres: { items: [{ name: "Audit" }] },
    canaux: { list: ["Google"] },
    presence: { list: ["Newsletter"] },
    objectifs: { list: ["Trouver plus de clients"] },
  };

  assert.equal(profileMemoryCompletion(memory).completed, 4);
  assert.equal(walkthroughContextCompletion(memory).complete, false);
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

test("centre UX-2 — une mission, un bouton plein et retour déduit", () => {
  assert.match(progressHook, /WALKTHROUGH_STORAGE_KEY/);
  assert.match(progressHook, /sessionStorage\.setItem\(PENDING_MISSION_KEY/);
  assert.match(progressHook, /pending !== "activity" && pending !== "voice"/);
  assert.match(center, /currentMission/);
  assert.doesNotMatch(center, /WALKTHROUGH_MISSIONS\.map|MissionCard/);
  assert.match(hero, /aria-describedby=\{goalId\}/);
  assert.match(hero, /className="sr-only"/);
  assert.equal((hero.match(/bg-violet px-4/g) ?? []).length, 1);
  assert.equal((hero.match(/Passer/g) ?? []).length, 1);
  assert.doesNotMatch(center + hero + stageList, /Marquer comme comprise|sur 11|0%/);
});

test("centre UX-2 — le premier rendu reste sous 70 mots visibles", () => {
  const visibleCopy = [
    "Guide",
    "Exploration libre",
    "Étape 1 sur 5",
    WALKTHROUGH_STAGES[0].title,
    WALKTHROUGH_MISSIONS[0].title,
    WALKTHROUGH_MISSIONS[0].action,
    "Passer",
    ...WALKTHROUGH_STAGES.map((stage) => stage.title),
    "Connecter vos outils",
    "Progression locale à ce navigateur.",
    "Réinitialiser la progression",
  ].join(" ");
  const words = visibleCopy.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu) ?? [];

  assert.ok(words.length < 70, `${words.length} mots visibles`);
});

test("centre UX-2 — scénario explicite, cinq étapes et sixième ligne", () => {
  assert.match(center, /\/entreprise\?onglet=connecteurs&prise_en_main=1&scenario=/);
  assert.match(center, /Chargez \$\{SCENARIO_LABELS\[selectedScenario\]\}/);
  assert.match(stageList, /WALKTHROUGH_STAGES\.map/);
  assert.match(stageList, /CONNECT_DATA_MISSION/);
  assert.match(stageList, /Connecter vos outils/);
  assert.match(walkthroughPage, /readMemory\(supabase, \["activite", "zone", "ton", "philosophie"\]\)/);
  assert.match(walkthroughPage, /walkthroughContextCompletion\(memory\)/);
});

test("centre UX-2 — sidebar et Aujourd’hui partagent x/5", () => {
  assert.match(sidebarLink, /walkthroughCompletedStageCount/);
  assert.match(sidebarLink, /Guide · \{completed\}\/5/);
  assert.doesNotMatch(sidebarLink, /WALKTHROUGH_MISSIONS|missions/);
  assert.match(todayProgress, /walkthroughCompletedStageCount/);
  assert.match(todayProgress, /\{completed\}\/5/);
  assert.match(demoPanel, /Reprendre la prise en main/);
  assert.match(sidebar, /WalkthroughSidebarLink/);
});
