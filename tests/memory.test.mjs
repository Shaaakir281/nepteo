/**
 * Tests de la mémoire entreprise — parties pures uniquement.
 * Runner : node:test. Node ≥ 22 (type-stripping du .ts importé).
 * lib/memory.ts n'a aucun import (ni `@/`, ni relatif) : type-stripping OK.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_SECTIONS,
  LLM_MEMORY_SECTIONS,
  PHILOSOPHY_MAX,
  normalizePhilosophy,
  philosophyBlock,
  philosophyText,
} from "../lib/memory.ts";

test("philosophie — section connue et exposée aux prompts", () => {
  assert.ok(MEMORY_SECTIONS.includes("philosophie"));
  assert.ok(LLM_MEMORY_SECTIONS.includes("philosophie"));
  // Toute section exposée aux prompts doit être une section réelle.
  for (const s of LLM_MEMORY_SECTIONS) {
    assert.ok(MEMORY_SECTIONS.includes(s), `section inconnue : ${s}`);
  }
});

test("normalizePhilosophy — champ facultatif, rien d'exploitable = vide", () => {
  assert.equal(normalizePhilosophy(""), "");
  assert.equal(normalizePhilosophy("   \n  \n "), "");
  assert.equal(normalizePhilosophy(undefined), "");
  assert.equal(normalizePhilosophy(null), "");
  assert.equal(normalizePhilosophy(42), "");
  assert.equal(normalizePhilosophy({ text: "x" }), "");
});

test("normalizePhilosophy — trim, retours à la ligne réduits, CRLF normalisés", () => {
  assert.equal(normalizePhilosophy("  Je travaille en direct.  "), "Je travaille en direct.");
  assert.equal(normalizePhilosophy("a\r\nb"), "a\nb");
  // Un saut de paragraphe est conservé, les rafales sont réduites.
  assert.equal(normalizePhilosophy("a\n\nb"), "a\n\nb");
  assert.equal(normalizePhilosophy("a\n\n\n\n\nb"), "a\n\nb");
});

test("philosophyText — lit la section, tolère les formes inattendues", () => {
  assert.equal(
    philosophyText({ philosophie: { text: " Je travaille en direct. " } }),
    "Je travaille en direct.",
  );
  assert.equal(philosophyText({}), "");
  assert.equal(philosophyText({ philosophie: {} }), "");
  assert.equal(philosophyText({ philosophie: null }), "");
  assert.equal(philosophyText({ philosophie: "texte brut" }), "");
  assert.equal(philosophyText({ philosophie: { text: 12 } }), "");
});

test("philosophyBlock — vide sans philosophie (prompt inchangé), sinon injecté", () => {
  // Le contrat qui protège de toute régression : pas de philosophie = "".
  assert.equal(philosophyBlock({}), "");
  assert.equal(philosophyBlock({ philosophie: { text: "   " } }), "");

  const block = philosophyBlock({ philosophie: { text: "Jamais de promesse en l'air." } });
  assert.ok(block.includes("Jamais de promesse en l'air."));
  assert.ok(block.startsWith("Philosophie de l'entreprise"));
  // Se termine par une ligne vide : concaténable devant le reste du prompt.
  assert.ok(block.endsWith("\n\n"));
});

test("normalizePhilosophy — borne la longueur sans jeter la saisie", () => {
  const long = "x".repeat(PHILOSOPHY_MAX + 500);
  const out = normalizePhilosophy(long);
  assert.equal(out.length, PHILOSOPHY_MAX);
  // Sous la borne, le texte est intact.
  const court = "y".repeat(PHILOSOPHY_MAX - 1);
  assert.equal(normalizePhilosophy(court), court);
});
