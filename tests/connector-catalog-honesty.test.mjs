import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);

test("CONN-0 — conserve les cinq catégories et les 22 intégrations proposées", async () => {
  const catalog = await readFile(new URL("lib/connectors.ts", root), "utf8");

  for (const title of [
    "Trouver et suivre les prospects",
    "Comprendre les visiteurs",
    "Suivre les campagnes",
    "Communiquer",
    "Suivre les ventes",
  ]) {
    assert.match(catalog, new RegExp(`title: "${title}"`));
  }

  assert.equal((catalog.match(/provider: "/g) ?? []).length, 22);
});

test("CONN-0 — une proposition est explicitement non connectée", async () => {
  const [card, panel, catalogUi, action] = await Promise.all([
    readFile(
      new URL("app/(cockpit)/connecteurs/_components/connector-card.tsx", root),
      "utf8",
    ),
    readFile(
      new URL("app/(cockpit)/entreprise/_components/connectors-panel.tsx", root),
      "utf8",
    ),
    readFile(
      new URL("app/(cockpit)/connecteurs/_components/connector-catalog.tsx", root),
      "utf8",
    ),
    readFile(new URL("app/(cockpit)/connecteurs/actions.ts", root), "utf8"),
  ]);

  assert.match(card, /Intégration proposée — non connectée/);
  assert.match(card, /Demander l&apos;intégration/);
  assert.match(card, /Demande enregistrée — non connectée/);
  assert.match(card, /Connecter via OAuth/);
  assert.match(panel + catalogUi, /aucun accès, synchronisation ou\s+échange de données/);
  assert.match(action, /reste `disconnected`/);
  assert.match(action, /event: "connector_requested"/);
});
