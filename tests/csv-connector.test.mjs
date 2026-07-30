import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CsvImportError,
  parseCsvProspects,
} from "../lib/connectors/csv.ts";

const parse = (text) => parseCsvProspects(text);

test("CSV — détecte un export français au point-virgule", () => {
  const result = parse(
    "\uFEFFNom;Courriel;Société;Statut;Dernier contact\n" +
      "Zoé Martin;zoe@example.fr;Atelier Épure;À relancer;29/07/2026\n" +
      "Nabil Amari;nabil@example.fr;Novalys;Nouveau;2026-07-12\n",
  );

  assert.equal(result.delimiter, ";");
  assert.equal(result.prospects.length, 2);
  assert.equal(result.mapping.company, "Société");
  assert.equal(result.prospects[0].name, "Zoé Martin");
  assert.equal(result.prospects[0].last_contact_at, "2026-07-29");
  assert.deepEqual(result.prospects[0].raw, {});
});

test("CSV — respecte les guillemets, virgules, retours ligne et guillemets échappés", () => {
  const result = parse(
    'Name,Email,Notes\n' +
      '"Marie Dupont",marie@example.fr,"A dit ""oui"",\nà rappeler jeudi"\n',
  );

  assert.equal(result.prospects.length, 1);
  assert.equal(result.prospects[0].notes, 'A dit "oui",\nà rappeler jeudi');
});

test("CSV — conserve les doublons comme deux fiches analysables", () => {
  const text =
    "Nom;Email\n" +
    "Camille Roy;camille@example.fr\n" +
    "Camille Roy;camille@example.fr\n";
  const first = parse(text);
  const second = parse(text);

  assert.equal(first.prospects.length, 2);
  assert.notEqual(
    first.prospects[0].external_id,
    first.prospects[1].external_id,
  );
  assert.deepEqual(
    first.prospects.map((row) => row.external_id),
    second.prospects.map((row) => row.external_id),
    "le même fichier doit garder les mêmes identifiants",
  );
});

test("CSV — l'identité reste stable après réordre ou modification d'une note", () => {
  const first = parse(
    "Nom;Email;Notes;Secret interne\n" +
      "Alice;alice@example.fr;Premier message;ne pas transmettre\n" +
      "Bruno;bruno@example.fr;À rappeler;confidentiel\n",
  );
  const second = parse(
    "Nom;Email;Notes;Secret interne\n" +
      "Bruno;bruno@example.fr;Rappel effectué;nouvelle valeur\n" +
      "Alice;alice@example.fr;Message corrigé;autre secret\n",
  );
  const ids = (result) =>
    new Map(result.prospects.map((row) => [row.email, row.external_id]));

  assert.deepEqual(ids(first), ids(second));
  assert.equal(first.prospects[0].raw["Secret interne"], undefined);
  assert.deepEqual(first.prospects[0].raw, {});
});

test("CSV — deux personnes partageant un email gardent leur identité après réordre", () => {
  const first = parse(
    "Nom;Email;Entreprise;Notes\n" +
      "Alice Martin;contact@acme.fr;ACME;Décideuse\n" +
      "Bruno Roy;contact@acme.fr;ACME;Prescripteur\n",
  );
  const second = parse(
    "Nom;Email;Entreprise;Notes\n" +
      "Bruno Roy;contact@acme.fr;ACME;Note modifiée\n" +
      "Alice Martin;contact@acme.fr;ACME;Autre note\n",
  );
  const ids = (result) =>
    new Map(result.prospects.map((row) => [row.name, row.external_id]));

  assert.deepEqual(ids(first), ids(second));
  assert.notEqual(
    first.prospects[0].external_id,
    first.prospects[1].external_id,
  );
});

test("CSV — l'identité ne dépend pas de l'arrivée ou du départ d'un email partagé", () => {
  const aliceOnly = parse(
    "Nom;Email;Entreprise\nAlice Martin;contact@acme.fr;ACME\n",
  );
  const shared = parse(
    "Nom;Email;Entreprise\n" +
      "Alice Martin;contact@acme.fr;ACME\n" +
      "Bruno Roy;contact@acme.fr;ACME\n",
  );
  const aliceAgain = parse(
    "Nom;Email;Entreprise\nAlice Martin;contact@acme.fr;ACME\n",
  );

  assert.equal(
    aliceOnly.prospects[0].external_id,
    shared.prospects.find((row) => row.name === "Alice Martin").external_id,
  );
  assert.equal(
    aliceOnly.prospects[0].external_id,
    aliceAgain.prospects[0].external_id,
  );
});

test("CSV — ignore les lignes sans nom ni email et les compte", () => {
  const result = parse(
    "Nom;Email;Entreprise\n" +
      "Lina; lina@example.fr ;ACME\n" +
      ";;Ligne sans contact\n",
  );

  assert.equal(result.prospects.length, 1);
  assert.equal(result.prospects[0].email, "lina@example.fr");
  assert.equal(result.ignoredRows, 1);
});

test("CSV — refuse les formats ambigus ou inutilisables", () => {
  assert.throws(
    () => parse('Nom,Email\n"Valeur non fermée,test@example.fr\n'),
    CsvImportError,
  );
  assert.throws(
    () => parse("Téléphone;Ville\n0102030405;Chartres\n"),
    /Aucune colonne « Nom » ou « Email »/,
  );
  assert.throws(
    () => parse("Nom;nom;Email\nA;B;a@example.fr\n"),
    /apparaît plusieurs fois/,
  );
  assert.throws(
    () => parse("Nom,Entreprise;Email\nAlice,ACME;alice@example.fr\n"),
    /séparateur du CSV est ambigu/,
  );
  assert.throws(
    () => parse(`Nom;Email;Notes\nAlice;a@example.fr;${"x".repeat(2_001)}\n`),
    /dépasse 2000 caractères pour « Notes »/,
  );
});

test("CSV — une colonne ne peut alimenter qu'un seul champ et sep= est accepté", () => {
  const result = parse(
    "sep=;\n" +
      "Email du contact;Date de contact;Nom entreprise\n" +
      "alice@example.fr;29/07/2026;ACME\n",
  );

  assert.equal(result.delimiter, ";");
  assert.equal(result.mapping.email, "Email du contact");
  assert.equal(result.mapping.last_contact_at, "Date de contact");
  assert.equal(result.mapping.company, "Nom entreprise");
  assert.equal(result.mapping.name, null);
  assert.equal(result.prospects[0].last_contact_at, "2026-07-29");
});

test("intégration CSV — remplacement et retrait délèguent aux RPC atomiques", async () => {
  const [action, migration, card, catalog] = await Promise.all([
    readFile(
      new URL(
        "../app/(cockpit)/connecteurs/csv/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/0021_atomic_csv_import.sql",
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
    readFile(new URL("../lib/connectors.ts", import.meta.url), "utf8"),
  ]);

  assert.match(action, /withRealDataMutationLock/);
  assert.match(action, /\.rpc\("replace_csv_prospects"/);
  assert.match(action, /\.rpc\("clear_csv_prospects"/);
  assert.match(action, /formData\.get\("confirm_clear"\) !== "on"/);
  assert.doesNotMatch(action, /\.from\("prospects"\)\s*\.(?:upsert|delete)/);

  assert.match(
    migration,
    /create or replace function public\.replace_csv_prospects\(/i,
  );
  assert.match(
    migration,
    /insert into public\.prospects[\s\S]*on conflict \(connector_id, external_id\) do update[\s\S]*delete from public\.prospects[\s\S]*update public\.connectors[\s\S]*insert into public\.journal/i,
  );
  assert.match(
    migration,
    /membership\.role in \('admin', 'marketing', 'direction'\)/i,
  );
  assert.match(
    migration,
    /foreign key \(connector_id, organization_id\)[\s\S]*references public\.connectors\(id, organization_id\)/i,
  );
  assert.match(migration, /source\.item -> 'raw' <> '\{\}'::jsonb/i);
  assert.match(
    migration,
    /revoke execute on function public\.replace_csv_prospects[\s\S]*from public, anon, authenticated[\s\S]*grant execute on function public\.replace_csv_prospects[\s\S]*to service_role/i,
  );
  assert.match(migration, /greatest\(version, 21\)/i);
  assert.match(card, /isImportProvider\(tool\.provider\)/);
  assert.match(catalog, /provider: "csv", name: "Fichier CSV"/);
});
