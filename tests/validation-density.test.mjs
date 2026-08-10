import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentFiles = [
  "validation-drawer.tsx",
  "validation-drawer-header.tsx",
  "validation-decision-footer.tsx",
  "validation-action-content.tsx",
  "validation-payload-utils.ts",
  "campaign-validation-evidence.tsx",
  "campaign-proposal-details.tsx",
  "action-draft-editor.tsx",
  "prospect-drafts.tsx",
  "prospect-draft-row.tsx",
  "action-value-feedback.tsx",
  "action-value-feedback-fields.tsx",
  "action-value-feedback-options.ts",
  "value-scorecard.tsx",
  "value-scorecard-details.tsx",
  "value-scorecard-metrics.tsx",
];

const entries = await Promise.all(componentFiles.map(async (name) => [
  name,
  await readFile(new URL(`../app/(cockpit)/_components/${name}`, import.meta.url), "utf8"),
]));
const sources = Object.fromEntries(entries);

test("UX-6 — chaque composant du lot reste sous 250 lignes", () => {
  for (const [name, source] of entries) {
    assert.ok(source.split(/\r?\n/).length <= 250, `${name} dépasse 250 lignes`);
  }
});

test("UX-6 — le brouillon précède les justifications et reste directement éditable", () => {
  const relaunch = sources["validation-action-content.tsx"];
  assert.ok(relaunch.indexOf("<ActionDraftEditor") < relaunch.indexOf("<SupportDetails"));
  assert.match(sources["action-draft-editor.tsx"], /<input[\s\S]*<textarea/);
  assert.match(sources["action-draft-editor.tsx"], /saveDraftEdit\(id, subject, body\)/);
  assert.doesNotMatch(sources["action-draft-editor.tsx"], /setEditing|>Modifier</);
});

test("UX-6 — justification, prospects et campagne sont repliés sans bloc vide", () => {
  const content = sources["validation-action-content.tsx"];
  assert.match(content, /<details[\s\S]*Sur quoi Nepteo s&apos;appuie/);
  assert.match(sources["prospect-drafts.tsx"], /if \(!list\?\.length\) return null[\s\S]*<details[\s\S]*Personnaliser par prospect/);
  assert.match(content, /action\.kind === "launch_campaign"[\s\S]*<CampaignContent/);
  assert.match(content, /hasDetails && \([\s\S]*Détail de la proposition/);
  assert.doesNotMatch(sources["campaign-proposal-details.tsx"], /\?\? "—"/);
});

test("UX-6 — le refus remplace le pied et conserve la raison bornée", () => {
  const footer = sources["validation-decision-footer.tsx"];
  assert.match(footer, /useState\(false\)[\s\S]*rejecting \? \([\s\S]*name="decision" value="reject"/);
  assert.match(footer, /name="reason"[\s\S]*required[\s\S]*minLength=\{3\}[\s\S]*maxLength=\{500\}/);
  assert.match(footer, /setRejecting\(true\)/);
});

test("UX-6 — retour terrain et scorecard n'exposent qu'un résumé", () => {
  const feedback = sources["action-value-feedback-fields.tsx"];
  assert.match(feedback, /C&apos;était utile \?[\s\S]*>Oui<[\s\S]*>Non</);
  assert.match(feedback, /<details[\s\S]*Préciser[\s\S]*Faux positif[\s\S]*Retouche du brouillon[\s\S]*Résultat déclaré/);

  const scorecard = sources["value-scorecard.tsx"];
  assert.match(scorecard, /label="Examinées"[\s\S]*label="Jugées utiles"[\s\S]*label="Réponses"/);
  assert.match(scorecard, /<details[\s\S]*Toutes les métriques[\s\S]*<ValueScorecardDetails/);
});
