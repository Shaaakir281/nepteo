import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWebsitePreviewApplicationSections,
  readWebsitePreviewCurrentProfile,
} from "../lib/research/website-preview-apply-rules.ts";

const options = {
  activityOptions: ["Services", "Produits"],
  audienceOptions: ["Particuliers", "Entreprises"],
  channelOptions: ["Google", "Email"],
};

test("application website_preview — accepte uniquement les sections explicites et bornées", () => {
  const result = parseWebsitePreviewApplicationSections(
    {
      activite: {
        activity_type: "Services",
        audience: "Entreprises",
        description: "  Conseil   marketing  ",
      },
      zone: { text: " France " },
      ton: { text: "Clair" },
      canaux: { list: ["Google", "Email"] },
      offres: {
        items: [
          { name: "Audit", price: "900 €", target: "PME", promise: "Plan priorisé" },
        ],
      },
      presence: { list: ["Newsletter mensuelle"] },
    },
    options,
  );

  assert.deepEqual(result, {
    ok: true,
    sections: {
      activite: {
        activity_type: "Services",
        audience: "Entreprises",
        description: "Conseil marketing",
      },
      zone: { text: "France" },
      ton: { text: "Clair" },
      canaux: { list: ["Google", "Email"] },
      offres: {
        items: [
          { name: "Audit", price: "900 €", target: "PME", promise: "Plan priorisé" },
        ],
      },
      presence: { list: ["Newsletter mensuelle"] },
    },
  });
});

test("application website_preview — refuse absence, section inconnue et écrasement vide", () => {
  assert.deepEqual(parseWebsitePreviewApplicationSections({}, options), {
    ok: false,
    reason: "nothing_selected",
  });
  for (const sections of [
    { objectifs: { list: ["Vendre"] } },
    { zone: { text: "" } },
    { canaux: { list: [] } },
    { offres: { items: [] } },
    { presence: { list: [] } },
  ]) {
    assert.deepEqual(parseWebsitePreviewApplicationSections(sections, options), {
      ok: false,
      reason: "invalid_sections",
    });
  }
});

test("application website_preview — refuse options libres et dépassements sans tronquer", () => {
  for (const sections of [
    { activite: { activity_type: "Autre", audience: "Entreprises" } },
    { canaux: { list: ["TikTok"] } },
    { zone: { text: "x".repeat(201) } },
    { presence: { list: Array.from({ length: 7 }, (_, index) => `Preuve ${index}`) } },
  ]) {
    assert.deepEqual(parseWebsitePreviewApplicationSections(sections, options), {
      ok: false,
      reason: "invalid_sections",
    });
  }
});

test("application website_preview — borne le snapshot actuel destiné à la comparaison", () => {
  assert.deepEqual(
    readWebsitePreviewCurrentProfile({
      activite: {
        activity_type: "Services",
        audience: "Entreprises",
        description: "Conseil",
      },
      zone: { text: "France" },
      objectifs: { list: ["Ne doit pas sortir"] },
      presence: { list: ["Avis clients"] },
    }),
    {
      activite: {
        activity_type: "Services",
        audience: "Entreprises",
        description: "Conseil",
      },
      zone: { text: "France" },
      presence: { list: ["Avis clients"] },
    },
  );
  assert.deepEqual(
    readWebsitePreviewCurrentProfile({
      activite: { description: "Fiche encore partielle" },
    }),
    { activite: { description: "Fiche encore partielle" } },
  );
});
