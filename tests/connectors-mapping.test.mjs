/**
 * Tests de la correspondance de colonnes (Phase 2) — détection auto + mapping explicite.
 * Runner : node:test (intégré). Node ≥ 22 requis (type-stripping du .ts importé).
 *   npm test
 * On vérifie : (1) parité de la détection auto avec l'ancien comportement (non-régression),
 * (2) fetch* qui honore un mapping explicite sur des en-têtes/propriétés exotiques.
 * `global.fetch` est mocké — aucune I/O réseau réelle.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  autoDetectSheetMapping,
  fetchSheetProspects,
} from "../lib/connectors/google-sheets.ts";
import {
  autoDetectNotionMapping,
  fetchNotionProspects,
} from "../lib/connectors/notion.ts";

/** Installe un mock de fetch le temps d'un test, puis le restaure. */
function withFetch(handler, fn) {
  const original = global.fetch;
  global.fetch = handler;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      global.fetch = original;
    });
}

const jsonRes = (body) => ({ ok: true, status: 200, json: async () => body });

// ---------------------------------------------------------------------------
// Google Sheets — détection auto (non-régression)
// ---------------------------------------------------------------------------

test("autoDetectSheetMapping — en-têtes standard", () => {
  const m = autoDetectSheetMapping(["Nom", "Email", "Entreprise", "Statut"]);
  assert.equal(m.name, "Nom");
  assert.equal(m.email, "Email");
  assert.equal(m.company, "Entreprise");
  assert.equal(m.stage, "Statut");
});

test("autoDetectSheetMapping — variantes FR/EN", () => {
  const m = autoDetectSheetMapping([
    "Contact",
    "Courriel",
    "Société",
    "Étape",
  ]);
  assert.equal(m.name, "Contact");
  assert.equal(m.email, "Courriel");
  assert.equal(m.company, "Société");
  assert.equal(m.stage, "Étape");
});

test("autoDetectSheetMapping — en-têtes exotiques non reconnus → null", () => {
  const m = autoDetectSheetMapping(["Structure", "Pipeline", "Divers"]);
  assert.equal(m.name, null);
  assert.equal(m.email, null);
  assert.equal(m.company, null);
  assert.equal(m.stage, null);
});

// ---------------------------------------------------------------------------
// Google Sheets — fetch avec mapping explicite
// ---------------------------------------------------------------------------

/** Répond aux deux appels de readSheet (méta puis valeurs). */
function sheetHandler(headers, dataRows) {
  return async (url) => {
    if (String(url).includes("fields=sheets.properties.title")) {
      return jsonRes({ sheets: [{ properties: { title: "Feuille 1" } }] });
    }
    return jsonRes({ values: [headers, ...dataRows] });
  };
}

test("fetchSheetProspects — mapping explicite sur en-têtes exotiques", async () => {
  const headers = ["Personne", "Adresse mail", "Structure", "Pipeline"];
  const rows = [
    ["Marie Fontaine", "marie@x.fr", "Atelier Luce", "Nouveau"],
    ["Karim Benali", "k@y.fr", "BatiPro", "Relancé"],
  ];
  await withFetch(sheetHandler(headers, rows), async () => {
    const mapping = {
      name: "Personne",
      email: "Adresse mail",
      company: "Structure",
      stage: "Pipeline",
    };
    const out = await fetchSheetProspects("tok", "sheet1", mapping);
    assert.equal(out.length, 2);
    assert.equal(out[0].name, "Marie Fontaine");
    assert.equal(out[0].email, "marie@x.fr");
    assert.equal(out[0].company, "Atelier Luce");
    assert.equal(out[0].stage, "Nouveau");
    assert.equal(out[0].external_id, "marie@x.fr"); // email minuscule
    // raw conserve toutes les colonnes d'origine
    assert.equal(out[0].raw["Structure"], "Atelier Luce");
  });
});

test("fetchSheetProspects — champ null ignoré (aucune colonne entreprise)", async () => {
  const headers = ["Personne", "Adresse mail"];
  const rows = [["Zoé", "zoe@x.fr"]];
  await withFetch(sheetHandler(headers, rows), async () => {
    const out = await fetchSheetProspects("tok", "sheet1", {
      name: "Personne",
      email: "Adresse mail",
      company: null,
      stage: null,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].company, null);
    assert.equal(out[0].stage, null);
  });
});

test("fetchSheetProspects — sans mapping, retombe sur la détection auto", async () => {
  const headers = ["Nom", "Email", "Entreprise", "Statut"];
  const rows = [["Alex", "alex@x.fr", "ACME", "Nouveau"]];
  await withFetch(sheetHandler(headers, rows), async () => {
    const out = await fetchSheetProspects("tok", "sheet1");
    assert.equal(out[0].name, "Alex");
    assert.equal(out[0].email, "alex@x.fr");
    assert.equal(out[0].company, "ACME");
    assert.equal(out[0].stage, "Nouveau");
  });
});

// ---------------------------------------------------------------------------
// Notion — détection auto (non-régression)
// ---------------------------------------------------------------------------

test("autoDetectNotionMapping — types + mots-clés", () => {
  const props = [
    { key: "Nom", type: "title" },
    { key: "Email", type: "email" },
    { key: "Entreprise", type: "rich_text" },
    { key: "Statut", type: "status" },
  ];
  const m = autoDetectNotionMapping(props);
  assert.equal(m.name, "Nom");
  assert.equal(m.email, "Email");
  assert.equal(m.company, "Entreprise");
  assert.equal(m.stage, "Statut");
});

test("autoDetectNotionMapping — stage via select (clé reconnue) si pas de status natif", () => {
  const props = [
    { key: "Titre", type: "title" },
    { key: "Statut", type: "select" },
  ];
  const m = autoDetectNotionMapping(props);
  assert.equal(m.stage, "Statut");
});

test("autoDetectNotionMapping — clé exotique non reconnue par l'auto → null (mapping explicite requis)", () => {
  const props = [
    { key: "Titre", type: "title" },
    { key: "Pipeline", type: "select" }, // clé hors regex → non détecté
  ];
  const m = autoDetectNotionMapping(props);
  assert.equal(m.stage, null);
});

// ---------------------------------------------------------------------------
// Notion — fetch avec mapping explicite
// ---------------------------------------------------------------------------

test("fetchNotionProspects — mapping explicite sur propriétés exotiques", async () => {
  const page = {
    id: "page1",
    properties: {
      Personne: { type: "title", title: [{ plain_text: "Marie" }] },
      "Adresse mail": { type: "email", email: "marie@x.fr" },
      Structure: { type: "select", select: { name: "Atelier Luce" } },
      Pipeline: { type: "status", status: { name: "Nouveau" } },
    },
  };
  const handler = async () => jsonRes({ results: [page] });
  await withFetch(handler, async () => {
    const out = await fetchNotionProspects("tok", "db1", {
      name: "Personne",
      email: "Adresse mail",
      company: "Structure",
      stage: "Pipeline",
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].name, "Marie");
    assert.equal(out[0].email, "marie@x.fr");
    assert.equal(out[0].company, "Atelier Luce");
    assert.equal(out[0].stage, "Nouveau");
    assert.equal(out[0].external_id, "page1");
  });
});

test("fetchNotionProspects — sans mapping, détection auto depuis le schéma", async () => {
  const page = {
    id: "page1",
    properties: {
      Nom: { type: "title", title: [{ plain_text: "Alex" }] },
      Email: { type: "email", email: "alex@x.fr" },
      Entreprise: { type: "rich_text", rich_text: [{ plain_text: "ACME" }] },
      Statut: { type: "status", status: { name: "Nouveau" } },
    },
  };
  const handler = async () => jsonRes({ results: [page] });
  await withFetch(handler, async () => {
    const out = await fetchNotionProspects("tok", "db1");
    assert.equal(out[0].name, "Alex");
    assert.equal(out[0].email, "alex@x.fr");
    assert.equal(out[0].company, "ACME");
    assert.equal(out[0].stage, "Nouveau");
  });
});
