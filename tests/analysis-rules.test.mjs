/**
 * Tests du moteur d'analyse (Phase 2) — règles pures, zéro dépendance.
 * Runner : node:test (intégré). Node ≥ 22 requis (type-stripping du .ts importé).
 *   npm test
 * On teste `buildFindings` : entrée = prospects normalisés, sortie = propositions.
 * Aucune I/O, aucun LLM, aucune DB — logique déterministe uniquement.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFindings,
  prospectPriority,
  isTerminalStage,
} from "../lib/analysis-rules.ts";

/** Fabrique un prospect ; source fixée pour un data_sources déterministe. */
const p = (name, email, company, stage) => ({
  name,
  email,
  company,
  stage,
  source: "google_sheets",
});

const find = (findings, kind) => findings.find((f) => f.kind === kind);

/** Réplique fidèle de docs/tests/prospects-test.csv (24 lignes). */
const CSV_FIXTURE = [
  p("Marie Fontaine", "marie.fontaine@atelier-luce.fr", "Atelier Luce", "Nouveau"),
  p("Karim Benali", "k.benali@batipro-idf.fr", "BatiPro IDF", "Nouveau"),
  p("Sophie Lemaire", "sophie@lemaire-conseil.fr", "Lemaire Conseil", "À relancer"),
  p("Thomas Girard", "t.girard@girard-menuiserie.fr", "Girard Menuiserie", "À relancer"),
  p("Nadia Cherif", "nadia.cherif@pharma-ouest.fr", "Pharma Ouest", "RDV planifié"),
  p("Julien Moreau", "", "Moreau Paysage", "Nouveau"),
  p("Claire Dubost", "claire@dubost-archi.fr", "Dubost Architecture", "Client"),
  p("Antoine Riva", "a.riva@riva-traiteur.fr", "Riva Traiteur", "À relancer"),
  p("Emma Laurent", "emma.laurent@fitcoach.fr", "FitCoach Studio", "Nouveau"),
  p("Pierre Vasseur", "", "Vasseur Immobilier", "À relancer"),
  p("Lucie Marchand", "l.marchand@marchand-opticiens.fr", "Marchand Opticiens", "RDV planifié"),
  p("Hugo Petit", "hugo@petit-webdesign.fr", "Petit Webdesign", "Nouveau"),
  p("Inès Roland", "ines.roland@roland-formation.fr", "Roland Formation", "Client"),
  p("David Costa", "d.costa@costa-renov.fr", "Costa Rénovation", "À relancer"),
  p("Camille Noyer", "", "Noyer & Fils", "Nouveau"),
  p("Yasmine Alaoui", "y.alaoui@alaoui-avocat.fr", "Cabinet Alaoui", "RDV planifié"),
  p("Marc Delattre", "marc@delattre-photo.fr", "Delattre Photo", "Perdu"),
  p("Julie Berthier", "julie.berthier@berthier-rh.fr", "Berthier RH", "Nouveau"),
  p("Romain Fabre", "", "Fabre Élec", "À relancer"),
  p("Anaïs Colin", "anais@colin-ceramique.fr", "Colin Céramique", "Nouveau"),
  p("Nicolas Sauvage", "n.sauvage@sauvage-agri.fr", "Sauvage Agri", "Client"),
  p("Laura Mendes", "laura.mendes@mendes-clean.fr", "Mendes Clean", "À relancer"),
  p("Olivier Brun", "", "Brun Logistique", "Perdu"),
  p("Sarah Klein", "sarah@klein-bijoux.fr", "Klein Bijoux", "Nouveau"),
];

test("base vide → aucune proposition", () => {
  assert.deepEqual(buildFindings([]), []);
});

test("CSV de test (24 prospects) → exactement 3 propositions", () => {
  const f = buildFindings(CSV_FIXTURE);
  assert.equal(
    f.length,
    3,
    "attendu : emails manquants + relance du plus gros groupe + relance en priorité",
  );

  const emails = find(f, "complete_missing_emails");
  assert.ok(emails, "règle emails manquants déclenchée");
  assert.equal(emails.payload.count, 5);
  assert.equal(emails.payload.total, 24);

  const relaunch = find(f, "relaunch_stage_nouveau");
  assert.ok(relaunch, "règle relance du plus gros statut déclenchée");
  assert.equal(relaunch.payload.stage, "Nouveau");
  assert.equal(relaunch.payload.count, 9);

  // Relancer en priorité = joignable (email présent) ET statut actif
  // (ni « Client » ni « Perdu »). Sur le CSV : 15 des 24 prospects.
  const priority = find(f, "relaunch_priority");
  assert.ok(priority, "règle relancer en priorité déclenchée");
  assert.equal(priority.payload.count, 15);
  assert.equal(priority.payload.total, 24);

  // Les règles plus strictes ne doivent PAS se déclencher sur ce jeu propre.
  assert.equal(find(f, "classify_unlabeled"), undefined);
  assert.equal(find(f, "dedupe_emails"), undefined);
  assert.equal(find(f, "complete_missing_company"), undefined);
});

test("aucun email manquant → pas de règle emails", () => {
  const f = buildFindings([
    p("A", "a@x.fr", "AA", "Nouveau"),
    p("B", "b@x.fr", "BB", "Nouveau"),
  ]);
  assert.equal(find(f, "complete_missing_emails"), undefined);
});

test("plus gros groupe : nécessite au moins 2", () => {
  // Deux statuts distincts (1 chacun) → aucune relance proposée.
  const f = buildFindings([
    p("A", "a@x.fr", "AA", "Nouveau"),
    p("B", "b@x.fr", "BB", "Client"),
  ]);
  assert.equal(
    f.find((x) => x.kind.startsWith("relaunch_stage_")),
    undefined,
  );
});

test("prospects sans statut → à classer (mais pas si tous sans statut)", () => {
  const mixed = buildFindings([
    p("A", "a@x.fr", "AA", "Nouveau"),
    p("B", "b@x.fr", "BB", "Nouveau"),
    p("C", "c@x.fr", "CC", ""),
    p("D", "d@x.fr", "DD", null),
  ]);
  const c = find(mixed, "classify_unlabeled");
  assert.ok(c, "déclenchée quand une partie est sans statut");
  assert.equal(c.payload.count, 2);

  // Tous sans statut → rien à comparer, la règle ne se déclenche pas.
  const allBlank = buildFindings([
    p("A", "a@x.fr", "AA", ""),
    p("B", "b@x.fr", "BB", null),
  ]);
  assert.equal(find(allBlank, "classify_unlabeled"), undefined);
});

test("doublons d'email détectés (insensibles à la casse)", () => {
  const f = buildFindings([
    p("A", "dup@x.fr", "AA", "S1"),
    p("B", "DUP@x.fr", "BB", "S2"),
    p("C", "other@x.fr", "CC", "S3"),
  ]);
  const d = find(f, "dedupe_emails");
  assert.ok(d, "règle doublons déclenchée");
  assert.equal(d.payload.duplicate_values, 1);
  assert.equal(d.payload.extra, 1);
});

test("entreprise manquante : seuil 40 % et base ≥ 5", () => {
  // 2 entreprises vides sur 5 = 40 % → déclenché. Statuts distincts → pas de relance.
  const atThreshold = buildFindings([
    p("A", "a@x.fr", "AA", "S1"),
    p("B", "b@x.fr", "BB", "S2"),
    p("C", "c@x.fr", "CC", "S3"),
    p("D", "d@x.fr", "", "S4"),
    p("E", "e@x.fr", null, "S5"),
  ]);
  const c = find(atThreshold, "complete_missing_company");
  assert.ok(c, "déclenché à 40 %");
  assert.equal(c.payload.count, 2);
  assert.equal(c.payload.total, 5);

  // 1 vide sur 5 = 20 % → non déclenché.
  const below = buildFindings([
    p("A", "a@x.fr", "AA", "S1"),
    p("B", "b@x.fr", "BB", "S2"),
    p("C", "c@x.fr", "CC", "S3"),
    p("D", "d@x.fr", "DD", "S4"),
    p("E", "e@x.fr", "", "S5"),
  ]);
  assert.equal(find(below, "complete_missing_company"), undefined);
});

test("priorité : joignable + statut actif → à relancer en priorité", () => {
  const pr = prospectPriority({ email: "a@x.fr", stage: "Nouveau", company: "AA" });
  assert.equal(pr.tier, "priority");
  assert.equal(pr.label, "À relancer en priorité");
});

test("priorité : email manquant → fiche à compléter (pas prioritaire)", () => {
  assert.equal(
    prospectPriority({ email: "", stage: "Nouveau", company: "AA" }).tier,
    "incomplete",
  );
  assert.equal(
    prospectPriority({ email: null, stage: "À relancer", company: "AA" }).tier,
    "incomplete",
  );
});

test("priorité : sans statut → fiche à compléter", () => {
  assert.equal(
    prospectPriority({ email: "a@x.fr", stage: "", company: "AA" }).tier,
    "incomplete",
  );
  assert.equal(
    prospectPriority({ email: "a@x.fr", stage: null, company: "AA" }).tier,
    "incomplete",
  );
});

test("priorité : statut terminal → en veille (pas de relance)", () => {
  for (const stage of ["Client", "Perdu", "Gagné", "Désabonné"]) {
    assert.equal(
      prospectPriority({ email: "a@x.fr", stage, company: "AA" }).tier,
      "paused",
      `« ${stage} » attendu en veille`,
    );
  }
});

test("isTerminalStage : insensible aux accents et à la casse", () => {
  assert.equal(isTerminalStage("Gagné"), true);
  assert.equal(isTerminalStage("PERDU"), true);
  assert.equal(isTerminalStage("Désabonné"), true);
  assert.equal(isTerminalStage("Nouveau"), false);
  assert.equal(isTerminalStage("À relancer"), false);
  assert.equal(isTerminalStage(""), false);
  assert.equal(isTerminalStage(null), false);
});

test("forme de chaque proposition : champs cohérents", () => {
  for (const f of buildFindings(CSV_FIXTURE)) {
    assert.equal(typeof f.kind, "string");
    assert.equal(typeof f.title, "string");
    assert.equal(typeof f.finding, "string");
    assert.equal(typeof f.rationale, "string");
    assert.ok(Array.isArray(f.data_sources) && f.data_sources.length >= 1);
    assert.ok(f.confidence > 0 && f.confidence <= 1);
    assert.ok(["low", "medium", "high"].includes(f.risk));
  }
});
