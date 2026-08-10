import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("UX-8 — conserve exactement 22 connecteurs et cinq catégories", async () => {
  const source = await read("lib/connectors.ts");
  assert.equal((source.match(/provider: "/g) ?? []).length, 22);
  assert.equal((source.match(/title: "/g) ?? []).length, 5);
});

test("UX-8 — le catalogue est recherchable, filtrable et garde les états honnêtes", async () => {
  const [catalog, card] = await Promise.all([
    read("app/(cockpit)/connecteurs/_components/connector-catalog.tsx"),
    read("app/(cockpit)/connecteurs/_components/connector-card.tsx"),
  ]);
  assert.match(catalog, /type="search"/);
  assert.match(catalog, /Tous[\s\S]*Branchés[\s\S]*Disponibles/);
  assert.match(catalog, /5 catégories/);
  assert.match(catalog, /connectedCount[\s\S]*sur \{entries\.length\}/);
  for (const status of ["Branché", "À vérifier", "En pause", "Erreur", "Prévu", "Disponible"]) assert.match(card, new RegExp(status));
  assert.match(card, /title=\{`\$\{tool\.description\} — \$\{copy\.long\}`\}/);
});

test("UX-8 — les tunnels provider et CSV montrent une étape à la fois", async () => {
  const [providerPage, providerSteps, csv] = await Promise.all([
    read("app/(cockpit)/connecteurs/[provider]/page.tsx"),
    read("app/(cockpit)/connecteurs/[provider]/_components/connector-setup-steps.tsx"),
    read("app/(cockpit)/connecteurs/csv/_components/csv-import-stepper.tsx"),
  ]);
  assert.match(providerSteps, /!authorized \? 1 : !configured \? 2 : 3/);
  assert.match(providerPage, /!configured && membership\.canViewFinancials/);
  assert.match(providerPage, /<details[\s\S]*Paramètres de source et correspondance des colonnes/);
  assert.match(csv, /useState\(1\)/);
  assert.match(csv, /Déposer[\s\S]*Vérifier[\s\S]*Confirmer/);
  assert.match(csv, /step === 1 \? "block" : "hidden"/);
  assert.match(csv, /Le fichier dépasse la limite de 900 Ko/);
  assert.match(csv, /type="submit"[\s\S]*Remplacer l'import CSV/);
});

test("UX-8 — le laboratoire conserve confirmation, preuve et application explicite", async () => {
  const [page, lab, result, application, review] = await Promise.all([
    read("app/(cockpit)/entreprise/laboratoire-web/page.tsx"),
    read("app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-lab.tsx"),
    read("app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-result.tsx"),
    read("app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-application.tsx"),
    read("app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-review-section.tsx"),
  ]);
  assert.match(page, /Coût, usage et conservation/);
  assert.match(lab, /confirmed: true/);
  assert.match(lab, /Confirmer et lancer/);
  assert.match(result, /result\.sources\.length/);
  assert.match(application, /useState<WebsitePreviewMemorySection\[\]>\(\(\) => selectableSections\(proposal\)\)/);
  assert.match(application, /if \(running \|\| selected\.length === 0 \|\| !confirmed\) return/);
  assert.match(application, /Appliquer les \$\{selected\.length\}/);
  assert.match(review, /vide → proposé/);
  assert.match(review, /rempli → remplacé/);
  assert.doesNotMatch(application, /useEffect/);
});

test("UX-8 — tous les composants du lot restent sous 250 lignes", async () => {
  const files = [
    "app/(cockpit)/entreprise/_components/connectors-panel.tsx",
    "app/(cockpit)/connecteurs/_components/connector-card.tsx",
    "app/(cockpit)/connecteurs/_components/connector-catalog.tsx",
    "app/(cockpit)/connecteurs/[provider]/page.tsx",
    "app/(cockpit)/connecteurs/[provider]/_components/connector-detail-header.tsx",
    "app/(cockpit)/connecteurs/[provider]/_components/connector-setup-steps.tsx",
    "app/(cockpit)/connecteurs/csv/page.tsx",
    "app/(cockpit)/connecteurs/csv/_components/csv-import-stepper.tsx",
    "app/(cockpit)/entreprise/laboratoire-web/page.tsx",
    "app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-lab.tsx",
    "app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-result.tsx",
    "app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-application.tsx",
    "app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-application-fields.tsx",
    "app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-review-section.tsx",
  ];
  for (const file of files) {
    const source = await read(file);
    assert.ok(source.split(/\r?\n/).length <= 250, `${file} dépasse 250 lignes`);
  }
});
