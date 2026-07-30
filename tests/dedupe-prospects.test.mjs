/**
 * Dédup à l'affichage — fonction pure, zéro dépendance. Node ≥ 22 (type-stripping).
 *   npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildProspectKpi,
  dedupeByEmail,
} from "../lib/dedupe-prospects.ts";
import { computeFunnelStats } from "../lib/analysis-rules.ts";

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

test("secours nom+entreprise : fusionne deux fiches sans email identiques", () => {
  const out = dedupeByEmail([
    p("1", "Zoé Blanc", null, "Studio Z", "Nouveau"),
    p("2", " zoé  blanc ", "", "studio z", null), // même nom+société normalisés
    p("3", "Zoé Blanc", null, "Autre SARL", "Nouveau"), // société ≠ → gardée
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "1");
  assert.equal(out[0].stage, "Nouveau"); // base conservée
});

test("garde les lignes sans email ni nom (non dédupliquables)", () => {
  const out = dedupeByEmail([
    p("1", null, "", null, "Nouveau"),
    p("2", null, null, null, "Nouveau"),
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

test("conserve le dernier contact le plus récent entre deux sources", () => {
  const rows = [
    { ...p("1", "Marie", "a@x.fr", "Luce", "Nouveau"), last_contact_at: "2026-06-15" },
    { ...p("2", "Marie", "a@x.fr", "Luce", "Nouveau"), last_contact_at: "2026-07-28" },
  ];
  const out = dedupeByEmail(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].last_contact_at, "2026-07-28");
});

test("le KPI et le funnel partagent 24 fiches dédoublonnées pour 48 lignes", () => {
  const rows = Array.from({ length: 24 }, (_, index) => [
    p(`${index}-a`, `Contact ${index}`, `contact${index}@x.fr`, "Luce", "Nouveau"),
    p(`${index}-b`, `Contact ${index}`, ` CONTACT${index}@x.fr `, "Luce", "Nouveau"),
  ]).flat();

  const { dedupedRows, ...summary } = buildProspectKpi(rows, 48, 5_000);
  assert.equal(dedupedRows?.length, 24);
  assert.equal(computeFunnelStats(dedupedRows ?? []).total, 24);
  assert.deepEqual(summary, {
    dedupedCount: 24,
    hasData: true,
    value: "24",
    hint: "fiches dédoublonnées · 48 lignes importées",
  });
});

test("le KPI ne calcule pas silencieusement sur un chargement partiel", () => {
  const rows = [
    p("1", "Marie", "marie@x.fr", "Luce", "Nouveau"),
    p("2", "Marie", "marie@x.fr", "Luce", "Nouveau"),
  ];

  assert.deepEqual(buildProspectKpi(rows, 48, 5_000), {
    dedupedCount: null,
    dedupedRows: null,
    hasData: true,
    value: "—",
    hint: "48 lignes importées · décompte dédoublonné indisponible",
  });
});

test("le KPI suspend explicitement le calcul au-delà de la borne", () => {
  assert.deepEqual(buildProspectKpi([], 5_001, 5_000), {
    dedupedCount: null,
    dedupedRows: null,
    hasData: true,
    value: "—",
    hint:
      `5${String.fromCharCode(8239)}001 lignes importées · ` +
      `décompte dédoublonné suspendu au-delà de 5${String.fromCharCode(8239)}000`,
  });
});

test("le KPI vide conserve hasData à false", () => {
  assert.deepEqual(buildProspectKpi([], 0, 5_000), {
    dedupedCount: 0,
    dedupedRows: [],
    hasData: false,
    value: "—",
    hint: "aucune ligne importée",
  });
});

test("un count indisponible ne fait pas passer une base inconnue pour vide", () => {
  assert.deepEqual(buildProspectKpi([], null, 5_000), {
    dedupedCount: null,
    dedupedRows: null,
    hasData: true,
    value: "—",
    hint: "décompte dédoublonné indisponible",
  });
});

test("le libellé reste honnête quand deux homonymes sont fusionnés", () => {
  const rows = [
    p("1", "Jean Martin", null, "Acme", "Nouveau"),
    p("2", "Jean Martin", null, "Acme", "Nouveau"),
  ];

  const { dedupedRows, ...summary } = buildProspectKpi(rows, 2, 5_000);
  assert.equal(dedupedRows?.length, 1);
  assert.deepEqual(summary, {
    dedupedCount: 1,
    hasData: true,
    value: "1",
    hint: "fiche dédoublonnée · 2 lignes importées",
  });
  assert.doesNotMatch(summary.hint, /unique/i);
});

test("PlanBanner consomme la cohorte reçue et ne relit pas prospects", () => {
  const source = readFileSync(
    new URL(
      "../app/(cockpit)/_components/plan-banner.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /\.from\(["']prospects["']\)/);
  assert.match(source, /if \(prospectCohort === null\) return null/);
  assert.match(source, /computeFunnelStats\(prospectCohort, today\)/);
});

test("le funnel utilise la date du jour et le dernier contact de la cohorte", () => {
  const stats = computeFunnelStats(
    [
      {
        email: "recent@example.test",
        stage: "Nouveau",
        company: "Nepteo",
        last_contact_at: "2026-07-28",
      },
      {
        email: "stale@example.test",
        stage: "Nouveau",
        company: "Nepteo",
        last_contact_at: "2026-06-20",
      },
    ],
    "2026-07-30",
  );

  assert.equal(stats.total, 2);
  assert.equal(stats.priority, 1);
});
