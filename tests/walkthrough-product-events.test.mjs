import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WALKTHROUGH_STORAGE_KEY,
  emptyWalkthroughState,
  parseWalkthroughState,
} from "../lib/onboarding/walkthrough.ts";
import { completeWalkthroughMissions } from "../lib/onboarding/walkthrough-client.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [decisions, today, progressHook, center, identityHero, priorityHero, queue] =
  await Promise.all([
    read("app/(cockpit)/_actions/decisions.ts"),
    read("app/(cockpit)/page.tsx"),
    read(
      "app/(cockpit)/prise-en-main/_components/use-walkthrough-progress.ts",
    ),
    read("app/(cockpit)/prise-en-main/_components/walkthrough-center.tsx"),
    read(
      "app/(cockpit)/entreprise/_components/identity-completion-hero.tsx",
    ),
    read("app/(cockpit)/_components/today-priority-hero.tsx"),
    read("app/(cockpit)/_components/validation-queue.tsx"),
  ]);

test("prise en main — une décision réussie progresse réellement", () => {
  assert.match(decisions, /relaunchApproval\.changed \? "\/\?walkthrough=decision"/);
  assert.match(decisions, /if \(!changed\) redirect\("\/"\)/);
  assert.match(decisions, /redirect\("\/\?walkthrough=decision"\)/);
  assert.match(
    today,
    /walkthrough === "decision"[\s\S]*"summary", "priorities", "rationale", "customize", "decide"/,
  );
});

test("prise en main — l'événement client met à jour le compteur partagé", () => {
  let stored = JSON.stringify(emptyWalkthroughState("example", "artisan"));
  let events = 0;
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return key === WALKTHROUGH_STORAGE_KEY ? stored : null;
      },
      setItem(key, value) {
        if (key === WALKTHROUGH_STORAGE_KEY) stored = value;
      },
    },
    dispatchEvent() {
      events += 1;
    },
  };

  try {
    completeWalkthroughMissions([
      "summary",
      "priorities",
      "rationale",
      "customize",
      "decide",
      "unknown",
    ]);
  } finally {
    globalThis.window = previousWindow;
  }

  assert.deepEqual(parseWalkthroughState(stored).completed, [
    "summary",
    "priorities",
    "rationale",
    "customize",
    "decide",
  ]);
  assert.equal(events, 1);
});

test("scénario — le guide montre la fiche avant de considérer le contexte acquis", () => {
  assert.match(progressHook, /if \(path !== "example"\)/);
  assert.match(
    progressHook,
    /path === "example" && pending === "activity"[\s\S]*"activity", "voice"/,
  );
  assert.match(center, /Découvrez la fiche remplie\./);
  assert.match(center, /simple adresse de site/);
  assert.match(center, /onglet=identite&prise_en_main=1/);
});

test("identité — le scénario explique clairement le remplissage depuis un site", () => {
  assert.match(identityHero, /Fiche d'exemple complète\./);
  assert.match(identityHero, /Le scénario a rempli ces 8 éléments/);
  assert.match(identityHero, /saisissez[\s\S]*l&apos;adresse du site/);
  assert.match(identityHero, /Continuer la prise en main/);
});

test("Aujourd'hui — la priorité reprend la densité des autres propositions", () => {
  for (const source of [priorityHero, queue]) {
    assert.match(source, /text-\[13\.5px\] font-semibold text-ink/);
    assert.match(source, /rounded-\[7px\] bg-tint/);
    assert.match(source, /px-\[18px\] py-3/);
  }
  assert.match(priorityHero, /rounded-\[13px\]/);
  assert.doesNotMatch(priorityHero, /text-\[24px\]|sm:text-\[29px\]/);
});
