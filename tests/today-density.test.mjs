import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, starter, queue, progress] = await Promise.all([
  readFile(new URL("../app/(cockpit)/page.tsx", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../app/(cockpit)/_components/starter-diagnostic.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../app/(cockpit)/_components/validation-queue.tsx",
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

test("UX-1 — le héros précède directement la file et reprend la priorité", () => {
  assert.match(page, /queue\[0\][\s\S]*TodayPriorityHero action=\{queue\[0\]\}/);
  assert.ok(page.indexOf("TodayPriorityHero") < page.indexOf('id="file-decisions"'));
  assert.match(page, /<TodayDetails title="Indicateurs"/);
  assert.match(page, /<TodayDetails title="Cap du mois"/);
  assert.match(page, /<TodayDetails title="Prospects dormants"/);
});

test("UX-1 — Pourquoi reste visible et sa réponse est repliée", () => {
  assert.match(starter, /<details[^>]*>[\s\S]*<summary[^>]*>[\s\S]*Pourquoi \?/);
  assert.doesNotMatch(starter, /<details[^>]+open/);
});

test("UX-1 — l'état vide de la file tient sur une ligne et un bouton outline", () => {
  assert.match(queue, /0 décision à valider/);
  assert.doesNotMatch(queue, /Chargez un scénario d&apos;exemple/);
  assert.match(queue, /AnalysisRunner variant="primary"/);
});

test("UX-1 — la progression écoute le guide et n'affiche que cinq étapes", () => {
  assert.match(progress, /WALKTHROUGH_STORAGE_KEY/);
  assert.match(progress, /WALKTHROUGH_UPDATED_EVENT/);
  assert.match(progress, /\{completed\}\/5/);
  assert.doesNotMatch(progress, /WALKTHROUGH_MISSIONS\.length/);
});
