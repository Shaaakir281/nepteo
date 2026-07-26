/**
 * Sauvegarde / restauration de la fiche entreprise pendant une démonstration.
 * Runner : node:test. Node ≥ 22. Parties pures uniquement.
 *
 * Ce qui compte ici : essayer une entreprise fictive ne doit JAMAIS coûter sa
 * fiche à l'utilisateur. Les cas ci-dessous rejouent le scénario du défaut
 * constaté le 2026-07-26 (chantier B1, docs/projets/demo-isolation.md).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_BACKUP_SECTION,
  buildDemoBackup,
  isReservedSection,
  parseDemoBackup,
  planMemoryRestore,
} from "../lib/demo/memory-backup-rules.ts";

const ORG = { name: "Atelier Réel", activity: "Peinture sur mesure" };
const AT = "2026-07-26T09:00:00.000Z";

const realRows = [
  { section: "activite", content: { activity_type: "Services", description: "Réel" } },
  { section: "zone", content: { text: "Dreux" } },
];

/** Ce que le scénario écrit par-dessus (les huit sections de `seedMemory`). */
const scenarioSections = [
  "activite",
  "zone",
  "canaux",
  "ton",
  "objectifs",
  "offres",
  "philosophie",
  "presence",
];

test("section de sauvegarde — réservée, hors du produit", () => {
  assert.equal(DEMO_BACKUP_SECTION, "__demo_backup");
  assert.ok(isReservedSection(DEMO_BACKUP_SECTION));
  for (const s of scenarioSections) {
    assert.equal(isReservedSection(s), false, `${s} est une vraie section`);
  }
});

test("sauvegarde — copie les sections réelles et les deux champs d'onboarding", () => {
  const backup = buildDemoBackup(realRows, ORG, AT);

  assert.equal(backup.v, 1);
  assert.equal(backup.saved_at, AT);
  assert.deepEqual(backup.org, ORG);
  assert.deepEqual(Object.keys(backup.sections).sort(), ["activite", "zone"]);
  assert.equal(backup.sections.zone.text, "Dreux");
});

test("sauvegarde — ne se sauvegarde jamais elle-même", () => {
  const backup = buildDemoBackup(
    [...realRows, { section: DEMO_BACKUP_SECTION, content: { v: 1 } }],
    ORG,
    AT,
  );
  assert.equal(DEMO_BACKUP_SECTION in backup.sections, false);
});

test("sauvegarde — une fiche vide donne une sauvegarde vide mais exploitable", () => {
  const backup = buildDemoBackup([], { name: "Nouvelle", activity: null }, AT);
  assert.deepEqual(backup.sections, {});
  assert.equal(backup.org.activity, null);

  // Au retrait, les huit sections du scénario partent : on retombe sur le vide.
  const plan = planMemoryRestore(backup, scenarioSections);
  assert.deepEqual(plan.upserts, []);
  assert.deepEqual(plan.deletes.sort(), [...scenarioSections].sort());
});

test("restauration — rend la fiche d'origine et retire ce que le scénario a ajouté", () => {
  const backup = buildDemoBackup(realRows, ORG, AT);
  // En base pendant la démo : les 8 sections du scénario + la sauvegarde.
  const during = [...scenarioSections, DEMO_BACKUP_SECTION];

  const plan = planMemoryRestore(backup, during);

  assert.deepEqual(
    plan.upserts.map((u) => u.section).sort(),
    ["activite", "zone"],
    "les sections d'origine sont réécrites, contenu compris",
  );
  assert.equal(
    plan.upserts.find((u) => u.section === "zone").content.text,
    "Dreux",
    "le contenu rendu est bien celui d'avant la démo",
  );
  assert.deepEqual(
    plan.deletes.sort(),
    ["canaux", "objectifs", "offres", "philosophie", "presence", "ton"],
    "les six sections ajoutées par le scénario partent",
  );
  assert.equal(
    plan.deletes.includes(DEMO_BACKUP_SECTION),
    false,
    "la sauvegarde n'est jamais supprimée par le plan — elle l'est à part, après coup",
  );
});

test("enchaîner deux scénarios — la sauvegarde initiale n'est pas écrasée", () => {
  // Le garde-fou est côté I/O (`backupMemoryOnce` ne sauvegarde que si rien
  // n'existe) ; ce test vérifie l'autre moitié : une sauvegarde relue rend bien
  // la fiche d'ORIGINE, pas l'état intermédiaire du scénario A.
  const backup = buildDemoBackup(realRows, ORG, AT);
  const stored = JSON.parse(JSON.stringify(backup)); // aller-retour jsonb
  const reread = parseDemoBackup(stored);

  const plan = planMemoryRestore(reread, [
    ...scenarioSections,
    DEMO_BACKUP_SECTION,
  ]);
  assert.equal(
    plan.upserts.find((u) => u.section === "activite").content.description,
    "Réel",
    "pas la description du scénario A",
  );
  assert.deepEqual(reread.org, ORG);
});

test("relecture — une sauvegarde illisible n'est pas restaurée à moitié", () => {
  assert.equal(parseDemoBackup(null), null);
  assert.equal(parseDemoBackup("texte"), null);
  assert.equal(parseDemoBackup([]), null);
  assert.equal(parseDemoBackup({}), null, "pas de version");
  assert.equal(parseDemoBackup({ v: 2, sections: {} }), null, "version inconnue");
  assert.equal(parseDemoBackup({ v: 1 }), null, "pas de sections");
  assert.equal(parseDemoBackup({ v: 1, sections: [] }), null, "sections mal formées");
});

test("relecture — tolère une sauvegarde partielle sans inventer", () => {
  const parsed = parseDemoBackup({ v: 1, sections: { zone: { text: "Dreux" } } });
  assert.deepEqual(parsed.org, { name: null, activity: null });
  assert.equal(parsed.saved_at, "");
  assert.equal(parsed.sections.zone.text, "Dreux");
});

test("plan de restauration — pas de doublon dans les suppressions", () => {
  const backup = buildDemoBackup([], ORG, AT);
  const plan = planMemoryRestore(backup, ["ton", "ton", "canaux"]);
  assert.deepEqual(plan.deletes, ["ton", "canaux"]);
});
