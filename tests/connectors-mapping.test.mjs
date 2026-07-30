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
import { normalizeContactDate } from "../lib/connectors/date-rules.ts";

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

test("autoDetectSheetMapping — détecte une colonne Notes", () => {
  const m = autoDetectSheetMapping(["Nom", "Email", "Remarques"]);
  assert.equal(m.notes, "Remarques");
  const m2 = autoDetectSheetMapping(["Nom", "Email", "Commentaire"]);
  assert.equal(m2.notes, "Commentaire");
  const m3 = autoDetectSheetMapping(["Nom", "Email"]);
  assert.equal(m3.notes, null);
});

test("autoDetectSheetMapping — détecte la date du dernier contact", () => {
  const m = autoDetectSheetMapping([
    "Nom",
    "Email",
    "Date de création",
    "Dernier contact",
  ]);
  assert.equal(m.last_contact_at, "Dernier contact");
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

test("fetchSheetProspects — normalise ISO et jj/mm/aaaa, invalide → null", async () => {
  const headers = ["Nom", "Email", "Relance"];
  const rows = [
    ["Alex", "alex@x.fr", "2026-07-09T10:30:00Z"],
    ["Zoé", "zoe@x.fr", "08/07/2026"],
    ["Sam", "sam@x.fr", "31/02/2026"],
  ];
  await withFetch(sheetHandler(headers, rows), async () => {
    const out = await fetchSheetProspects("tok", "sheet1", {
      name: "Nom",
      email: "Email",
      last_contact_at: "Relance",
    });
    assert.equal(out[0].last_contact_at, "2026-07-09");
    assert.equal(out[1].last_contact_at, "2026-07-08");
    assert.equal(out[2].last_contact_at, null);
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
    { key: "Notes", type: "rich_text" },
  ];
  const m = autoDetectNotionMapping(props);
  assert.equal(m.name, "Nom");
  assert.equal(m.email, "Email");
  assert.equal(m.company, "Entreprise");
  assert.equal(m.stage, "Statut");
  assert.equal(m.notes, "Notes");
});

test("autoDetectNotionMapping — stage via select (clé reconnue) si pas de status natif", () => {
  const props = [
    { key: "Titre", type: "title" },
    { key: "Statut", type: "select" },
  ];
  const m = autoDetectNotionMapping(props);
  assert.equal(m.stage, "Statut");
});

test("autoDetectNotionMapping — préfère la propriété date du dernier contact", () => {
  const props = [
    { key: "Nom", type: "title" },
    { key: "Création", type: "date" },
    { key: "Dernière relance", type: "date" },
  ];
  const m = autoDetectNotionMapping(props);
  assert.equal(m.last_contact_at, "Dernière relance");
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

test("fetchNotionProspects — lit une propriété date", async () => {
  const page = {
    id: "page1",
    properties: {
      Nom: { type: "title", title: [{ plain_text: "Alex" }] },
      Email: { type: "email", email: "alex@x.fr" },
      "Dernier contact": {
        type: "date",
        date: { start: "2026-07-01T09:00:00.000+02:00" },
      },
    },
  };
  await withFetch(async () => jsonRes({ results: [page] }), async () => {
    const out = await fetchNotionProspects("tok", "db1");
    assert.equal(out[0].last_contact_at, "2026-07-01");
  });
});

test("fetchNotionProspects — suit la pagination au-delà de 100 lignes", async () => {
  const page = (id) => ({
    id,
    properties: {
      Nom: { type: "title", title: [{ plain_text: id }] },
      Email: { type: "email", email: `${id}@x.fr` },
    },
  });
  const bodies = [];
  const handler = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (!body.start_cursor) {
      return jsonRes({
        results: [page("premier")],
        has_more: true,
        next_cursor: "cursor-2",
      });
    }
    return jsonRes({
      results: [page("second")],
      has_more: false,
      next_cursor: null,
    });
  };

  await withFetch(handler, async () => {
    const out = await fetchNotionProspects("tok", "db1");
    assert.deepEqual(
      out.map((p) => p.name),
      ["premier", "second"],
    );
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].start_cursor, "cursor-2");
  });
});

test("normalizeContactDate — rejette les valeurs ambiguës ou impossibles", () => {
  assert.equal(normalizeContactDate("2026-02-29"), null);
  assert.equal(normalizeContactDate("29-07-2026"), null);
  assert.equal(normalizeContactDate(""), null);
  assert.equal(normalizeContactDate(null), null);
});
