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
  DORMANT_COHORT_LIMIT,
  daysSinceContact,
  matchesRelaunchTarget,
  prospectPriority,
  selectDormantProspects,
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

const daysBefore = (today, days) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

const dormant = (id, lastContactAt, overrides = {}) => ({
  id,
  email: `${id}@example.com`,
  stage: "Nouveau",
  company: `Entreprise ${id}`,
  last_contact_at: lastContactAt,
  ...overrides,
});

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
  assert.equal(relaunch.payload.count, 7);

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

test("cohorte canonique : chiffres métier sur 24 fiches, doublons sur 48 lignes brutes", () => {
  const rawRows = [
    ...CSV_FIXTURE,
    ...CSV_FIXTURE.map((prospect) => ({
      ...prospect,
      source: "notion",
    })),
  ];

  const findings = buildFindings(CSV_FIXTURE, rawRows);
  assert.equal(findings.length, 4);

  const emails = find(findings, "complete_missing_emails");
  assert.ok(emails);
  assert.equal(emails.payload.count, 5);
  assert.equal(emails.payload.total, 24);

  const relaunch = find(findings, "relaunch_stage_nouveau");
  assert.ok(relaunch);
  assert.equal(relaunch.payload.count, 7);
  assert.match(relaunch.finding, /7 prospects sur 24/);

  const priority = find(findings, "relaunch_priority");
  assert.ok(priority);
  assert.equal(priority.payload.count, 15);
  assert.equal(priority.payload.total, 24);

  const dedupe = find(findings, "dedupe_emails");
  assert.ok(dedupe, "les doublons restent détectés dans les lignes physiques");
  assert.equal(dedupe.payload.duplicate_values, 19);
  assert.equal(dedupe.payload.extra, 19);

  for (const finding of findings) {
    assert.deepEqual(finding.data_sources, [
      "prospects (google_sheets, notion)",
    ]);
  }
});

test("aucun email manquant → pas de règle emails", () => {
  const f = buildFindings([
    p("A", "a@x.fr", "AA", "Nouveau"),
    p("B", "b@x.fr", "BB", "Nouveau"),
  ]);
  assert.equal(find(f, "complete_missing_emails"), undefined);
});

test("un email blanc est compté comme manquant", () => {
  const findings = buildFindings([
    p("A", "   ", "AA", "Nouveau"),
    p("B", "b@x.fr", "BB", "Nouveau"),
  ]);
  const missing = find(findings, "complete_missing_emails");

  assert.ok(missing);
  assert.equal(missing.payload.count, 1);
  assert.equal(missing.payload.total, 2);
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

test("relance par statut : compte uniquement les prospects actifs et joignables", () => {
  const f = buildFindings([
    p("A", "a@x.fr", "AA", "Nouveau"),
    p("B", "b@x.fr", "BB", "Nouveau"),
    p("Sans email", "", "CC", "Nouveau"),
    p("Client 1", "c1@x.fr", "DD", "Client"),
    p("Client 2", "c2@x.fr", "EE", "Client"),
    p("Client 3", "c3@x.fr", "FF", "Client"),
  ]);

  const relaunch = find(f, "relaunch_stage_nouveau");
  assert.ok(relaunch);
  assert.equal(relaunch.payload.count, 2);
  assert.equal(find(f, "relaunch_stage_client"), undefined);
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

test("priorité temporelle : moins de 7 jours → aucune relance", () => {
  const recent = prospectPriority(
    {
      email: "a@x.fr",
      stage: "Nouveau",
      company: "AA",
      last_contact_at: "2026-07-24",
    },
    "2026-07-29",
  );
  assert.equal(recent.tier, "paused");
  assert.equal(recent.label, "Contact récent");
  assert.equal(recent.daysSinceContact, 5);

  const boundary = prospectPriority(
    {
      email: "a@x.fr",
      stage: "Nouveau",
      company: "AA",
      last_contact_at: "2026-07-22",
    },
    "2026-07-29",
  );
  assert.equal(boundary.tier, "priority", "7 jours révolus → relance permise");
});

test("priorité temporelle : 21 jours → silence explicite et prioritaire", () => {
  const stale = prospectPriority(
    {
      email: "a@x.fr",
      stage: "À relancer",
      company: "AA",
      last_contact_at: "2026-07-08",
    },
    "2026-07-29",
  );
  assert.equal(stale.tier, "priority");
  assert.equal(stale.label, "Sans nouvelle depuis 21 jours");
  assert.equal(stale.daysSinceContact, 21);
});

test("règles temporelles : les contacts récents sont exclus des relances", () => {
  const prospects = [
    { ...p("Récent", "r@x.fr", "R", "Nouveau"), last_contact_at: "2026-07-27" },
    { ...p("Attente", "a@x.fr", "A", "Nouveau"), last_contact_at: "2026-07-19" },
    { ...p("Ancien", "v@x.fr", "V", "Nouveau"), last_contact_at: "2026-06-20" },
    p("Sans date", "s@x.fr", "S", "Nouveau"),
  ];
  const findings = buildFindings(prospects, "2026-07-29");
  assert.equal(find(findings, "relaunch_stage_nouveau").payload.count, 3);
  const priority = find(findings, "relaunch_priority");
  assert.equal(priority.payload.count, 3);
  assert.equal(priority.payload.stale_count, 1);
  assert.equal(priority.payload.oldest_contact_days, 39);
});

test("sans date de contact → comportement historique strictement identique", () => {
  assert.deepEqual(
    buildFindings(CSV_FIXTURE, "2026-07-29"),
    buildFindings(CSV_FIXTURE),
  );
});

test("daysSinceContact — calcul UTC contrôlé et date future prudente", () => {
  assert.equal(daysSinceContact("2026-07-28", "2026-07-29"), 1);
  assert.equal(daysSinceContact("2026-08-01", "2026-07-29"), 0);
  assert.equal(daysSinceContact("date invalide", "2026-07-29"), null);
});

test("cohorte dormante — seuils stricts 30/45 et bornes inclusives", () => {
  const today = "2026-07-30";
  const prospects = [
    dormant("j29", daysBefore(today, 29)),
    dormant("j30", daysBefore(today, 30)),
    dormant("j45", daysBefore(today, 45)),
  ];

  assert.deepEqual(
    selectDormantProspects(prospects, today, 30).map(({ id }) => id),
    ["j45", "j30"],
  );
  assert.deepEqual(
    selectDormantProspects(prospects, today, 45).map(({ id }) => id),
    ["j45"],
  );

  for (const unsupportedThreshold of [29, 31, 44, 46]) {
    assert.deepEqual(
      selectDormantProspects(prospects, today, unsupportedThreshold),
      [],
      `le seuil ${unsupportedThreshold} ne doit pas être accepté`,
    );
  }
});

test("cohorte dormante — date obligatoire, valide et non future", () => {
  const today = "2026-07-30";
  const valid = dormant("valide", daysBefore(today, 45));
  const prospects = [
    dormant("absente", null),
    dormant("vide", ""),
    dormant("invalide", "2026-02-30"),
    dormant("format", "30/05/2026"),
    dormant("future", "2026-08-01"),
    valid,
  ];

  const selected = selectDormantProspects(prospects, today, 30);
  assert.deepEqual(selected.map(({ id }) => id), ["valide"]);
  assert.strictEqual(
    selected[0],
    valid,
    "la sélection restitue le fait source, sans fabriquer de prospect",
  );
  assert.deepEqual(selectDormantProspects(prospects, undefined, 30), []);
  assert.deepEqual(selectDormantProspects(prospects, "date invalide", 30), []);
});

test("cohorte dormante — exige un prospect actif et joignable", () => {
  const today = "2026-07-30";
  const oldContact = daysBefore(today, 45);
  const prospects = [
    dormant("actif", oldContact),
    dormant("sans-email", oldContact, { email: "  " }),
    dormant("sans-statut", oldContact, { stage: "" }),
    dormant("terminal", oldContact, { stage: "Client" }),
    dormant("opposition", oldContact, { stage: "Désabonné" }),
  ];

  assert.deepEqual(
    selectDormantProspects(prospects, today, 30).map(({ id }) => id),
    ["actif"],
  );

  for (const stage of [
    "Opposition",
    "Opposé",
    "Ne pas contacter",
    "Do not contact",
    "DNC",
    "Opt-out",
  ]) {
    assert.deepEqual(
      selectDormantProspects(
        [dormant(`opposition-${stage}`, oldContact, { stage })],
        today,
        30,
      ),
      [],
      `le statut « ${stage} » doit fermer la cohorte`,
    );
  }
});

test("cohorte dormante — sélectionne les 50 silences les plus anciens", () => {
  const today = "2026-07-30";
  const prospects = Array.from({ length: 55 }, (_, index) =>
    dormant(`p${index}`, daysBefore(today, 30 + index)),
  );

  const selected = selectDormantProspects(prospects, today, 30);
  assert.equal(selected.length, DORMANT_COHORT_LIMIT);
  assert.equal(selected[0].id, "p54");
  assert.equal(selected.at(-1).id, "p5");
  assert.equal(selected.some(({ id }) => id === "p4"), false);
});

test("cohorte dormante — égalités stables et entrée non mutée", () => {
  const today = "2026-07-30";
  const prospects = [
    dormant("égalité-1", daysBefore(today, 45)),
    dormant("plus-ancien", daysBefore(today, 60)),
    dormant("égalité-2", daysBefore(today, 45)),
  ];
  const snapshot = structuredClone(prospects);

  const selected = selectDormantProspects(prospects, today, 30);

  assert.deepEqual(selected.map(({ id }) => id), [
    "plus-ancien",
    "égalité-1",
    "égalité-2",
  ]);
  assert.deepEqual(prospects, snapshot);
  assert.notStrictEqual(selected, prospects);
});

test("matchesRelaunchTarget — dormant revalide le seuil et les faits courants", () => {
  const today = "2026-07-30";
  const at30Days = dormant("j30", daysBefore(today, 30));
  const at45Days = dormant("j45", daysBefore(today, 45));

  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 30 },
      at30Days,
      today,
    ),
    true,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 45 },
      at30Days,
      today,
    ),
    false,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 45 },
      at45Days,
      today,
    ),
    true,
  );

  for (const payload of [
    {},
    { min_silence_days: 29 },
    { min_silence_days: 31 },
    { min_silence_days: "30" },
  ]) {
    assert.equal(
      matchesRelaunchTarget(
        "relaunch_dormant",
        payload,
        at45Days,
        today,
      ),
      false,
    );
  }

  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 30 },
      { ...at45Days, stage: "Perdu" },
      today,
    ),
    false,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 30 },
      { ...at45Days, email: null },
      today,
    ),
    false,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 30 },
      { ...at45Days, last_contact_at: "date invalide" },
      today,
    ),
    false,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_dormant",
      { min_silence_days: 30 },
      { ...at45Days, last_contact_at: "2026-08-01" },
      today,
    ),
    false,
  );
});

test("matchesRelaunchTarget — priorité cible uniquement le tier priority", () => {
  const active = {
    email: "active@example.com",
    stage: "Nouveau",
    company: "Active",
    last_contact_at: "2026-07-10",
  };
  const incomplete = { ...active, email: "" };
  const terminal = { ...active, stage: "Client" };

  assert.equal(
    matchesRelaunchTarget("relaunch_priority", {}, active, "2026-07-29"),
    true,
  );
  assert.equal(
    matchesRelaunchTarget("relaunch_priority", {}, incomplete, "2026-07-29"),
    false,
  );
  assert.equal(
    matchesRelaunchTarget("relaunch_priority", {}, terminal, "2026-07-29"),
    false,
  );
});

test("matchesRelaunchTarget — relance de stage compare le payload", () => {
  const prospect = {
    email: "a@example.com",
    stage: "Nouveau",
    company: "A",
    last_contact_at: "2026-07-10",
  };
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_nouveau",
      { stage: "Nouveau" },
      prospect,
      "2026-07-29",
    ),
    true,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_relancer",
      { stage: "À relancer" },
      prospect,
      "2026-07-29",
    ),
    false,
  );
});

test("matchesRelaunchTarget — relance de stage revalide joignabilité et statut actif", () => {
  const base = {
    email: "a@example.com",
    stage: "Nouveau",
    company: "A",
    last_contact_at: "2026-07-10",
  };

  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_nouveau",
      { stage: "Nouveau" },
      { ...base, email: "" },
      "2026-07-29",
    ),
    false,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_client",
      { stage: "Client" },
      { ...base, stage: "Client" },
      "2026-07-29",
    ),
    false,
  );
});

test("matchesRelaunchTarget — normalise les espaces du stage", () => {
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_nouveau",
      { stage: "  Nouveau " },
      {
        email: "a@example.com",
        stage: " Nouveau  ",
        company: "A",
        last_contact_at: "2026-07-10",
      },
      "2026-07-29",
    ),
    true,
  );
});

test("matchesRelaunchTarget — exclut un contact récent", () => {
  const recent = {
    email: "a@example.com",
    stage: "Nouveau",
    company: "A",
    last_contact_at: "2026-07-27",
  };
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_priority",
      {},
      recent,
      "2026-07-29",
    ),
    false,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_nouveau",
      { stage: "Nouveau" },
      recent,
      "2026-07-29",
    ),
    false,
  );
});

test("matchesRelaunchTarget — refuse un kind inconnu", () => {
  assert.equal(
    matchesRelaunchTarget(
      "complete_missing_emails",
      { stage: "Nouveau" },
      {
        email: "a@example.com",
        stage: "Nouveau",
        company: "A",
        last_contact_at: "2026-07-10",
      },
      "2026-07-29",
    ),
    false,
  );
});

test("matchesRelaunchTarget — une date absente conserve le comportement historique", () => {
  const withoutDate = {
    email: "a@example.com",
    stage: "Nouveau",
    company: "A",
  };
  assert.equal(
    matchesRelaunchTarget("relaunch_priority", {}, withoutDate, "2026-07-29"),
    true,
  );
  assert.equal(
    matchesRelaunchTarget(
      "relaunch_stage_nouveau",
      { stage: "Nouveau" },
      withoutDate,
      "2026-07-29",
    ),
    true,
  );
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
