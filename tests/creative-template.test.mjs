/**
 * Tests du conseil créatif (Phase 4) — repli déterministe pur.
 * Runner : node:test. Node ≥ 22. Aucun LLM, aucune I/O.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  templateCreativeBrief,
  CHANNEL_LABELS,
  buildCreativeSuggestions,
} from "../lib/creative-template.ts";

const seed = (over = {}) => ({
  objectif: "promouvoir l'offre découverte",
  canal: "indifferent",
  activite: "coaching sportif",
  offre: "Pack Découverte 3 séances",
  cibles: "actifs 30-45 ans",
  ton: "motivant",
  ...over,
});

test("templateCreativeBrief — brief complet, produit et objectif cités", () => {
  const b = templateCreativeBrief(seed());
  assert.ok(b.includes("Pack Découverte 3 séances"));
  assert.ok(b.includes("promouvoir l'offre découverte"));
  assert.ok(b.includes("coaching sportif"));
  assert.ok(/Angles créatifs/i.test(b));
  assert.ok(/Accroches/i.test(b));
  assert.ok(/transmettre/i.test(b)); // exploitable en aval
});

test("templateCreativeBrief — mentionne le canal choisi", () => {
  const b = templateCreativeBrief(seed({ canal: "newsletter" }));
  assert.ok(b.includes(CHANNEL_LABELS.newsletter));
});

test("buildCreativeSuggestions — propose à partir des signaux connus", () => {
  const s = buildCreativeSuggestions({
    offre: "Pack Découverte",
    priorityCount: 15,
    losingCampaigns: ["Notoriété Reels"],
  });
  assert.ok(s.length >= 3 && s.length <= 4);
  assert.ok(s.some((x) => /Notoriété Reels/.test(x.label) && x.canal === "pub"));
  assert.ok(s.some((x) => /15 prospects/.test(x.label) && x.canal === "newsletter"));
  assert.ok(s.some((x) => /Pack Découverte/.test(x.label)));
});

test("buildCreativeSuggestions — toujours au moins une idée, même sans données", () => {
  const s = buildCreativeSuggestions({});
  assert.ok(s.length >= 1);
  // pas de suggestion « réactiver » si peu de prospects prioritaires
  assert.ok(!s.some((x) => /prospects prêts/.test(x.label)));
});

test("templateCreativeBrief — reste correct avec des champs vides, sans undefined", () => {
  const b = templateCreativeBrief({
    objectif: "",
    canal: "indifferent",
    activite: "",
    offre: "",
    cibles: "",
    ton: "",
  });
  assert.ok(b.length > 100);
  assert.ok(!b.includes("undefined"));
  assert.ok(!b.includes("()")); // pas de secteur vide entre parenthèses
});
