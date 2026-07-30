import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cartes OAuth — le blocage par la démonstration reste explicite et non interactif", async () => {
  const [panel, card] = await Promise.all([
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
  assert.match(
    card,
    /status === "available"[\s\S]*isOauthProvider\(tool\.provider\)[\s\S]*!canEdit[\s\S]*blockedByDemo[\s\S]*Retirez la démonstration pour reconnecter\./,
  );
  assert.match(
    card,
    /status !== "connected" && isOauthProvider\(tool\.provider\) && canEdit/,
    "le bouton OAuth des éditeurs hors démonstration reste disponible",
  );
});
