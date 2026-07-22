/**
 * Tests des brouillons de relance (Phase 2) — parties pures uniquement.
 * Runner : node:test. Node ≥ 22 (type-stripping du .ts importé).
 * On ne teste pas l'appel LLM (I/O) : seulement le gabarit de repli déterministe
 * et le prédicat de ciblage des actions de relance.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { templateRelance, isRelanceKind } from "../lib/draft-template.ts";

test("isRelanceKind — cible les relances, pas les autres", () => {
  assert.equal(isRelanceKind("relaunch_priority"), true);
  assert.equal(isRelanceKind("relaunch_stage_nouveau"), true);
  assert.equal(isRelanceKind("complete_missing_emails"), false);
  assert.equal(isRelanceKind("dedupe_emails"), false);
  assert.equal(isRelanceKind("classify_unlabeled"), false);
});

test("templateRelance — message complet avec placeholder {prénom}", () => {
  const d = templateRelance({ stage: "Nouveau", activite: "coaching sportif" });
  assert.ok(d.subject.length > 0);
  assert.ok(d.body.includes("{prénom}"));
  assert.ok(d.body.includes("coaching sportif"));
  assert.ok(d.body.includes("Nouveau")); // statut cité
});

test("templateRelance — reste correct sans statut ni activité", () => {
  const d = templateRelance({});
  assert.ok(d.subject.length > 0);
  assert.ok(d.body.includes("{prénom}"));
  assert.ok(d.body.trim().length > 40);
  // pas de « undefined » ni de mention de statut vide
  assert.ok(!d.body.includes("undefined"));
  assert.ok(!d.body.includes("« »"));
});
