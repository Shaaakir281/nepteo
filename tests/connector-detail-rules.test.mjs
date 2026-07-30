import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeNotionDatabaseChoice,
  parseNotionDatabaseChoice,
  remoteListError,
  remoteListState,
} from "../app/(cockpit)/connecteurs/[provider]/_lib/detail-rules.ts";

test("choix Notion — l'identifiant et le titre font un aller-retour ensemble", () => {
  const database = { id: "db-42", title: "Prospects qualifiés" };

  assert.deepEqual(
    parseNotionDatabaseChoice(encodeNotionDatabaseChoice(database)),
    database,
  );
});

test("choix Notion — sélectionner la deuxième base ne reprend jamais le premier titre", () => {
  const first = { id: "db-1", title: "Première base" };
  const second = { id: "db-2", title: "Deuxième base" };

  const firstPayload = encodeNotionDatabaseChoice(first);
  const secondPayload = encodeNotionDatabaseChoice(second);

  assert.notEqual(secondPayload, firstPayload);
  assert.deepEqual(parseNotionDatabaseChoice(secondPayload), second);
  assert.notDeepEqual(parseNotionDatabaseChoice(secondPayload), first);
});

test("choix Notion — refuse les payloads invalides, vides ou hors bornes", () => {
  assert.equal(parseNotionDatabaseChoice(null), null);
  assert.equal(parseNotionDatabaseChoice("pas du json"), null);
  assert.equal(parseNotionDatabaseChoice(JSON.stringify({ id: "db" })), null);
  assert.equal(parseNotionDatabaseChoice(JSON.stringify(["", "Titre"])), null);
  assert.equal(parseNotionDatabaseChoice(JSON.stringify(["db", ""])), null);
  assert.equal(
    parseNotionDatabaseChoice(JSON.stringify(["x".repeat(201), "Titre"])),
    null,
  );
  assert.equal(
    parseNotionDatabaseChoice(JSON.stringify(["db", "x".repeat(501)])),
    null,
  );
});

test("chargement distant — distingue success, empty et error", () => {
  const item = { id: "db-2", title: "Deuxième base" };

  assert.deepEqual(remoteListState([]), { status: "empty", items: [] });
  assert.deepEqual(remoteListState([item]), {
    status: "success",
    items: [item],
  });
  assert.deepEqual(remoteListError("indisponible"), {
    status: "error",
    message: "indisponible",
  });
});
