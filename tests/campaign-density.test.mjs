import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, cockpit, hero, details, weekly, creative] = await Promise.all([
  read("app/(cockpit)/campagnes/page.tsx"),
  read("app/(cockpit)/campagnes/_components/campaign-decision-cockpit.tsx"),
  read("app/(cockpit)/campagnes/_components/campaign-decision-hero.tsx"),
  read("app/(cockpit)/campagnes/_components/campaign-decision-details.tsx"),
  read("app/(cockpit)/campagnes/_components/campaign-weekly-insights.tsx"),
  read("app/(cockpit)/campagnes/_components/campaign-creative-audit.tsx"),
]);

test("UX-4 — les deux sentinelles surdimensionnées sont découpées", () => {
  assert.ok(page.split(/\r?\n/).length <= 250);
  assert.ok(cockpit.split(/\r?\n/).length <= 250);
});

test("UX-4 — les deux créations restent accessibles dans l’en-tête", () => {
  assert.match(page, /href="\/contenu\?libre=1"/);
  assert.match(page, /Créer un visuel/);
  assert.match(page, /<NewCampaignModal initialDraft=\{campaignBriefDefaults\} \/>/);
  assert.ok(page.indexOf("<NewCampaignModal") < page.indexOf("<CampaignDecisionCockpit"));
});

test("UX-4 — Décision, Rapport et Historique sont exclusifs", () => {
  assert.match(cockpit, /type CampaignTab = "decision" \| "report" \| "history"/);
  for (const label of ["Décision", "Rapport", "Historique"]) {
    assert.match(cockpit, new RegExp(`"${label}"`));
  }
  assert.match(cockpit, /tab === "decision"/);
  assert.match(cockpit, /tab === "report"/);
  assert.match(cockpit, /tab === "history"/);
});

test("UX-4 — l’onglet Décision reste centré sur trois KPI et un geste dominant", () => {
  assert.match(hero, /kpis\.slice\(0, 3\)/);
  assert.match(hero, /Rien à mesurer pour l’instant/);
  assert.match(hero, /Brancher un compte publicitaire/);
  assert.match(hero, /Aucune décision prioritaire/);
  assert.match(hero, /Point de vigilance/);
  assert.match(hero, /Pourquoi cette conclusion \?/);
  assert.match(hero, /Rechercher des actions à valider/);
  assert.match(hero, /<form action=\{analyzeAdsForm\}>/);
  assert.doesNotMatch(hero, /NewCampaignModal/);
});

test("UX-4 — les vérifications secondaires sont trois details fermés", () => {
  assert.equal((details.match(/<details>/g) ?? []).length, 3);
  assert.doesNotMatch(details, /<details[^>]*\sopen/);
  assert.match(details, /Ce que Nepteo a vérifié/);
  assert.match(details, /Prospects synchronisés/);
  assert.match(details, /Un démarrage journalisé n&apos;est pas un succès fournisseur/);
});

test("UX-4 — aucune question n’est proposée sans rapport disponible", () => {
  assert.match(weekly, /report\.state === "available" && \(/);
  assert.match(weekly, /insights\.questions\.map/);
  assert.match(creative, /<details/);
  assert.match(creative, /Audit créatif indisponible/);
});
