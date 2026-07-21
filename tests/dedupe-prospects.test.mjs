/**
 * Dédup à l'affichage — fonction pure, zéro dépendance. Node ≥ 22 (type-stripping).
 *   npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { dedupeByEmail } from "../lib/dedupe-prospects.ts";

const p = (id, name, email, company, stage) => ({ id, name, email, company, stage });

test("regroupe les emails identiques (casse et espaces ignorés)", () => {
  const out = dedupeByEmail([
    p("1", "Marie", "marie@x.fr", "Luce", "Nouveau"),
    p("2", "Marie", " MARIE@x.fr ", "Luce", "Nouveau"),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "1"); // la 1re (la plus récente) sert de base
});

test("complète les champs vides depuis un doublon, sans écraser", () => {
  const out = dedupeByEmail([
    p("1", "Marie", "a@x.fr", null, "Nouveau"),
    p("2", "Marie", "a@x.fr", "Luce", "Perdu"),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].company, "Luce"); // vide complété
  assert.equal(out[0].stage, "Nouveau"); // valeur de base conservée
});

test("garde les lignes sans email (non dédupliquables)", () => {
  const out = dedupeByEmail([
    p("1", "A", "", null, "Nouveau"),
    p("2", "B", null, null, "Nouveau"),
  ]);
  assert.equal(out.length, 2);
});

test("ne mute pas l'entrée d'origine", () => {
  const rows = [
    p("1", "Marie", "a@x.fr", null, "Nouveau"),
    p("2", "Marie", "a@x.fr", "Luce", null),
  ];
  dedupeByEmail(rows);
  assert.equal(rows[0].company, null);
});
