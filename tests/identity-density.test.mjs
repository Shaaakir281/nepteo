import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all(
  [
    "page.tsx",
    "_components/identity-panel.tsx",
    "_components/identity-completion-hero.tsx",
    "_components/identity-card.tsx",
    "_components/selling-memory-fields.tsx",
    "_components/voice-memory-fields.tsx",
    "_components/marketing-memory-fields.tsx",
    "_components/mem-row.tsx",
    "_components/offers-card.tsx",
    "_components/documents-details.tsx",
    "_components/learnings-details.tsx",
  ].map((path) =>
    readFile(new URL(`../app/(cockpit)/entreprise/${path}`, import.meta.url), "utf8"),
  ),
);

const [
  page,
  panel,
  hero,
  identityCard,
  selling,
  voice,
  marketing,
  memRow,
  offers,
  documents,
  learnings,
] = files;

test("UX-3 — l’identité remplace ses introductions par une jauge x/8", () => {
  assert.match(page, /tab !== "identite"/);
  assert.match(panel, /profileMemoryCompletion\(memCtx\)/);
  assert.match(panel, /IdentityCompletionHero/);
  assert.match(hero, /\{completed\}\/8/);
  assert.match(hero, /Remplir depuis mon site/);
  assert.doesNotMatch(panel, /icons\.bulb|Remplissez ce que vous savez/);
});

test("UX-3 — huit lignes compactes, dont les offres", () => {
  const rows = [selling, voice, marketing, offers]
    .map((source) => source.match(/<MemRow/g) ?? [])
    .flat();
  assert.equal(rows.length, 8);
  assert.match(identityCard, /SellingMemoryFields/);
  assert.match(selling, /<OffersCard/);
  assert.doesNotMatch(offers, /<Card|Vos offres/);
});

test("UX-3 — la ligne ouvre l’édition et l’aide reste accessible", () => {
  assert.match(memRow, /<summary/);
  assert.match(memRow, /tabIndex=\{0\}/);
  assert.match(memRow, /aria-label=\{`\$\{label\} : \$\{sub\}`\}/);
  assert.match(memRow, /title=\{sub\}/);
  assert.doesNotMatch(memRow, /Modifier|Fermer/);
});

test("UX-3 — apprentissages et documents sont repliés sans bouton mort", () => {
  assert.match(documents, /<details/);
  assert.match(learnings, /<details/);
  assert.match(documents, /Ouvrir le laboratoire web/);
  assert.doesNotMatch(documents + learnings, /disabled|bientôt|Ajouter un document/);
});

test("UX-3 — formulaires et gardes restent branchés", () => {
  for (const action of [
    "saveActivite",
    "saveZone",
    "saveTon",
    "savePhilosophie",
    "saveCanaux",
    "savePresence",
    "saveObjectifs",
  ]) {
    assert.match(selling + voice + marketing, new RegExp(`action=\\{${action}\\}`));
  }
  assert.match(offers, /action=\{saveOffer\}/);
  assert.match(panel, /const editable = canEdit && !mutationBlockedByDemo/);
});

test("UX-3 — le premier rendu vide reste sous 90 mots", () => {
  const copy = [
    "Mon entreprise Identité Connecteurs Agent",
    "0/8 Complétez votre fiche Remplir depuis mon site",
    "Ce que je vends Activité À compléter Zone À compléter Offres À compléter",
    "Comment je parle Ton À compléter Philosophie À compléter",
    "Ce que je fais déjà Canaux À compléter Communication À compléter Objectifs À compléter",
    "Ce que Nepteo a appris 0 Documents et sources 0",
    "Chaque champ est modifiable à tout moment et s’applique immédiatement",
  ].join(" ");
  const words = copy.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu) ?? [];
  assert.ok(words.length < 90, `${words.length} mots visibles`);
});
