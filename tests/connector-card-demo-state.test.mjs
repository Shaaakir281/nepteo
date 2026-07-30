import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("mode démo — les données simulées restent explicites sans lien OAuth actif", async () => {
  const [layout, sidebar, panel, card] = await Promise.all([
    readFile(
      new URL("../app/(cockpit)/layout.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/_components/sidebar.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/entreprise/_components/connectors-panel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/(cockpit)/connecteurs/_components/connector-card.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(panel, /canEdit=\{canEdit && !hasDemo\}/);
  assert.match(panel, /blockedByDemo=\{hasDemo\}/);
  assert.match(panel, /isTrustedDemoConnectorConfig\(r\.config\)/);
  assert.match(
    layout,
    /Démonstration active — données fictives\.[\s\S]*Aucun compte externe n&apos;est connecté/,
  );
  assert.match(sidebar, /Démonstration · données fictives/);
  assert.match(
    panel,
    /Mode démonstration actif\.[\s\S]*aucun compte externe n&apos;est connecté[\s\S]*organisation séparée/,
  );
  assert.match(
    card,
    /status === "available"[\s\S]*isOauthProvider\(tool\.provider\)[\s\S]*!canEdit[\s\S]*blockedByDemo[\s\S]*Aperçu démo — connexion réelle désactivée\./,
  );
  assert.match(
    card,
    /status !== "connected" && isOauthProvider\(tool\.provider\) && canEdit/,
    "le bouton OAuth des éditeurs hors démonstration reste disponible",
  );
});
