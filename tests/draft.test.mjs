/**
 * Tests des brouillons de relance (Phase 2) — parties pures uniquement.
 * Runner : node:test. Node ≥ 22 (type-stripping du .ts importé).
 * On ne teste pas l'appel LLM (I/O) : seulement le gabarit de repli déterministe
 * et le prédicat de ciblage des actions de relance.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  templateRelance,
  isRelanceKind,
  renderProspectContext,
  firstName,
  applyFirstName,
} from "../lib/draft-template.ts";

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

test("renderProspectContext — nom, notes perso et toutes colonnes brutes", () => {
  const ctx = renderProspectContext({
    name: "Marie Fontaine",
    company: "Atelier Luce",
    stage: "Nouveau",
    notes: "Rencontrée au salon, très intéressée par l'offre premium.",
    raw: { Ville: "Lyon", Budget: 5000, Vide: "", Email: "marie@x.fr" },
  });
  assert.ok(ctx.includes("Marie Fontaine"));
  assert.ok(ctx.includes("Notes personnelles : Rencontrée au salon"));
  assert.ok(ctx.includes("Ville : Lyon"));
  assert.ok(ctx.includes("Budget : 5000"));
  assert.ok(!ctx.includes("Vide :")); // colonnes vides ignorées
});

test("renderProspectContext — champs vides → contexte vide, pas de undefined", () => {
  const ctx = renderProspectContext({ name: null, raw: {} });
  assert.equal(ctx, "");
  assert.ok(!ctx.includes("undefined"));
});

test("firstName — premier mot du nom, vide si absent", () => {
  assert.equal(firstName("Marie Fontaine"), "Marie");
  assert.equal(firstName("  Karim  Benali "), "Karim");
  assert.equal(firstName(""), "");
  assert.equal(firstName(null), "");
});

test("applyFirstName — remplace {prénom} par le vrai prénom", () => {
  const d = applyFirstName(
    { subject: "Bonjour", body: "Bonjour {prénom}, ça va ?" },
    "Marie Fontaine",
  );
  assert.equal(d.body, "Bonjour Marie, ça va ?");
});

test("applyFirstName — variantes d'accent/casse, gère plusieurs occurrences", () => {
  const d = applyFirstName(
    { subject: "{Prenom}", body: "{prenom} et {prénom}" },
    "Alex Martin",
  );
  assert.equal(d.subject, "Alex");
  assert.equal(d.body, "Alex et Alex");
});

test("applyFirstName — sans nom, garde {prénom}", () => {
  const d = applyFirstName({ subject: "x", body: "Bonjour {prénom}" }, null);
  assert.equal(d.body, "Bonjour {prénom}");
});

test("renderProspectContext — ne duplique pas une valeur déjà citée", () => {
  const ctx = renderProspectContext({
    company: "ACME",
    raw: { Entreprise: "ACME", Secteur: "BTP" },
  });
  // « ACME » n'apparaît qu'une fois (via Entreprise:), pas re-listé dans Autres infos
  assert.equal(ctx.match(/ACME/g).length, 1);
  assert.ok(ctx.includes("Secteur : BTP"));
});
