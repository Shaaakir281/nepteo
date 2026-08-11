import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { campaignBriefDefaultsFromMemory } from "../lib/campaign-brief-defaults.ts";

const root = new URL("../", import.meta.url);
const componentFiles = [
  "app/(cockpit)/campagnes/_components/new-campaign-modal.tsx",
  "app/(cockpit)/campagnes/_components/campaign-modal-shell.tsx",
  "app/(cockpit)/campagnes/_components/campaign-brief-form.tsx",
  "app/(cockpit)/campagnes/_components/campaign-brief-fields.tsx",
  "app/(cockpit)/campagnes/_components/campaign-proposal-review.tsx",
  "app/(cockpit)/campagnes/_components/campaign-proposal-adsets.tsx",
  "app/(cockpit)/campagnes/_components/campaign-proposal-hooks.tsx",
  "app/(cockpit)/campagnes/_components/campaign-proposal-evidence.tsx",
  "app/(cockpit)/campagnes/_components/campaign-competition-research.tsx",
  "app/(cockpit)/contenu/_components/creative-workspace.tsx",
  "app/(cockpit)/contenu/_components/creative-story-settings.tsx",
  "app/(cockpit)/contenu/_components/creative-asset-gallery.tsx",
  "app/(cockpit)/contenu/_components/creative-secondary-options.tsx",
  "app/(cockpit)/contenu/_components/story-preview.tsx",
];

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("UX-9 — la mémoire renseignée préremplit les onze valeurs sans écriture", () => {
  const defaults = campaignBriefDefaultsFromMemory({
    activite: { audience: "Entreprises", description: "Conseil industriel" },
    zone: { text: "France" },
    canaux: { list: ["Prospection", "Événements"] },
    objectifs: { list: ["Obtenir plus de rendez-vous"] },
    offres: { items: [{ name: "Audit", price: "2 400 €", promise: "Clarifier le positionnement" }] },
    ton: { text: "Direct" },
    philosophie: { text: "Aucune promesse non prouvée" },
  });
  assert.deepEqual(Object.keys(defaults), [
    "objective", "campaignType", "audience", "offer", "hypothesis", "channel",
    "dailyBudget", "durationDays", "primaryMetric", "successThreshold", "context",
  ]);
  assert.ok(Object.values(defaults).every((value) => value.length > 0));
  assert.equal(defaults.objective, "appointments");
  assert.equal(defaults.channel, "linkedin");
  assert.match(defaults.audience, /Entreprises.*France/);
  assert.match(defaults.offer, /Audit.*2 400 €/);
  assert.ok(Object.values(campaignBriefDefaultsFromMemory({})).every((value) => value === ""));
});

test("UX-9 — le brief expose quatre champs puis replie les sept réglages", async () => {
  const [form, page, modal] = await Promise.all([
    source("app/(cockpit)/campagnes/_components/campaign-brief-form.tsx"),
    source("app/(cockpit)/campagnes/page.tsx"),
    source("app/(cockpit)/campagnes/_components/new-campaign-modal.tsx"),
  ]);
  const visible = form.slice(form.indexOf("return ("), form.indexOf("<details"));
  for (const label of ["Objectif", "Budget par jour", "Audience", "Offre"]) assert.match(visible, new RegExp(label));
  for (const label of ["Type de campagne", "Hypothèse à tester", "Canal", "Durée", "Métrique principale", "Seuil de succès", "Contexte facultatif"]) assert.doesNotMatch(visible, new RegExp(label));
  assert.match(form, /<details[\s\S]*Affiner[\s\S]*7 réglages/);
  assert.match(page, /readMemory\([\s\S]*campaignBriefDefaultsFromMemory/);
  assert.match(modal, /initialDraft/);
  assert.doesNotMatch(modal, /l&apos;agent construit, vous arbitrez/);
});

test("UX-9 — la proposition tient au premier rendu et conserve les garde-fous repliés", async () => {
  const [review, footer, evidence, hooks] = await Promise.all([
    source("app/(cockpit)/campagnes/_components/campaign-proposal-review.tsx"),
    source("app/(cockpit)/campagnes/_components/campaign-modal-shell.tsx"),
    source("app/(cockpit)/campagnes/_components/campaign-proposal-evidence.tsx"),
    source("app/(cockpit)/campagnes/_components/campaign-proposal-hooks.tsx"),
  ]);
  assert.equal((review.match(/<details/g) ?? []).length, 2);
  assert.match(review, /CompactAdSetList[\s\S]*SelectedHook/);
  assert.match(review, /Estimation indisponible/);
  assert.match(review, /7 jours distincts, une dépense positive et 10 conversions/);
  assert.match(review, /Aucun benchmark de canal/);
  assert.doesNotMatch([review, evidence, hooks].join("\n"), /Récapitulatif complet/);
  assert.match(hooks, /selectedHookIndices\.length === 0/);
  assert.match(footer, /Ajouter à la file[\s\S]*Modifier le brief/);
  assert.ok(footer.indexOf("Créer le visuel de cette campagne") < footer.indexOf("Le faire plus tard"));
});

test("UX-9 — l'aperçu précède les réglages et la génération reste explicite", async () => {
  const [workspace, state, secondary, preview] = await Promise.all([
    source("app/(cockpit)/contenu/_components/creative-workspace.tsx"),
    source("app/(cockpit)/contenu/_components/use-creative-workspace.ts"),
    source("app/(cockpit)/contenu/_components/creative-secondary-options.tsx"),
    source("app/(cockpit)/contenu/_components/story-preview.tsx"),
  ]);
  assert.ok(workspace.indexOf("<StoryPreview") < workspace.indexOf("<CreativeStorySettings"));
  assert.match(workspace, /Générer/);
  assert.match(workspace, /déduit du canal/);
  assert.match(workspace, /aucun visuel publié chez un fournisseur/);
  assert.match(state, /requestedCampaign \?\? campaigns\[0\]/);
  assert.match(state, /initialCampaign\?\.recommendedFormat/);
  assert.equal((secondary.match(/<details/g) ?? []).length, 2);
  assert.match(secondary, /Suggestions de l&apos;agent/);
  assert.match(secondary, /Création libre, sans campagne/);
  assert.match(workspace, /Studio de visuels/);
  assert.match(preview, /story: "aspect-\[9\/16\] w-full max-w-\[332px\]"/);
  assert.match(preview, /square: "aspect-square w-full max-w-\[590px\]"/);
  assert.match(preview, /landscape: "aspect-\[3\/2\] w-full max-w-\[885px\]"/);
  assert.doesNotMatch(preview, /max-h-\[590px\]/);
});

test("UX-9 — tous les composants touchés restent sous 250 lignes", async () => {
  for (const path of componentFiles) {
    const lines = (await source(path)).split(/\r?\n/).length;
    assert.ok(lines < 250, `${path} contient ${lines} lignes`);
  }
});
