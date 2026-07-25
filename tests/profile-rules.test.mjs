/**
 * Tests de la proposition d'identité (onboarding enrichi) — parties pures.
 * Runner : node:test. Node ≥ 22. Les options de la mémoire sont injectées
 * (pas d'import relatif de valeur : cf. piège type-stripping, docs/SUIVI.md).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractJson,
  isProposalUseful,
  parseIdentityProposal,
  snapToOption,
} from "../lib/research/profile-rules.ts";

const OPTIONS = {
  activityOptions: [
    "Services",
    "Produits",
    "SaaS ou application",
    "E-commerce",
    "Plusieurs activités",
    "Je ne sais pas encore",
  ],
  audienceOptions: [
    "Particuliers",
    "Entreprises",
    "Les deux",
    "Collectivités ou associations",
  ],
  channelOptions: [
    "Recommandations",
    "Réseaux sociaux",
    "Publicité",
    "Google",
    "Email",
    "Prospection",
    "Événements",
    "Autre",
  ],
};

test("snapToOption — recale sur une option valide, sinon rien", () => {
  assert.equal(snapToOption("services", OPTIONS.activityOptions), "Services");
  assert.equal(snapToOption("  PRODUITS ", OPTIONS.activityOptions), "Produits");
  // Accents ignorés, correspondance partielle tolérée.
  assert.equal(snapToOption("evenements", OPTIONS.channelOptions), "Événements");
  assert.equal(snapToOption("SaaS", OPTIONS.activityOptions), "SaaS ou application");
  // Hors options : on n'invente pas une valeur que la mémoire refuserait.
  assert.equal(snapToOption("Artisanat du cuir", OPTIONS.activityOptions), undefined);
  assert.equal(snapToOption("", OPTIONS.activityOptions), undefined);
  assert.equal(snapToOption(null, OPTIONS.activityOptions), undefined);
});

test("extractJson — tolère les balises et le bavardage autour du JSON", () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('Voici :\n```json\n{"a":1}\n```\nVoilà.'), { a: 1 });
  assert.equal(extractJson("pas de json"), null);
  assert.equal(extractJson('{"a": bancal}'), null);
  assert.equal(extractJson("[1,2]"), null, "un tableau n'est pas une proposition");
  assert.equal(extractJson(null), null);
});

test("parseIdentityProposal — nettoie, recale et borne", () => {
  const p = parseIdentityProposal(
    JSON.stringify({
      activity_type: "services",
      audience: "entreprises",
      description: "  Nous   posons des fenêtres.  ",
      zone: "Île-de-France",
      ton: "direct",
      canaux: ["google", "Recommandations", "google", "TikTok"],
      offres: [
        { name: "Pose", price: "à partir de 900 €", target: "particuliers" },
        { name: "", price: "ignorée" },
        { promise: "sans nom donc ignorée" },
      ],
      gaps: ["Chiffre d'affaires introuvable"],
    }),
    OPTIONS,
  );

  assert.equal(p.activity_type, "Services");
  assert.equal(p.audience, "Entreprises");
  assert.equal(p.description, "Nous posons des fenêtres.");
  assert.equal(p.ton, "direct");
  // Canaux : dédupliqués, et « TikTok » écarté (hors options).
  assert.deepEqual(p.canaux, ["Google", "Recommandations"]);
  // Une offre sans nom n'est pas une offre.
  assert.equal(p.offres.length, 1);
  assert.equal(p.offres[0].name, "Pose");
  assert.equal(p.offres[0].promise, undefined);
  assert.deepEqual(p.gaps, ["Chiffre d'affaires introuvable"]);
});

test("parseIdentityProposal — champs absents omis, jamais devinés", () => {
  const p = parseIdentityProposal('{"description":"Nous vendons du café."}', OPTIONS);
  assert.equal(p.description, "Nous vendons du café.");
  assert.equal(p.activity_type, undefined);
  assert.equal(p.audience, undefined);
  assert.equal(p.zone, undefined);
  assert.deepEqual(p.canaux, []);
  assert.deepEqual(p.offres, []);
  assert.deepEqual(p.gaps, []);
});

test("parseIdentityProposal — sortie inexploitable = null (repli sur la saisie manuelle)", () => {
  assert.equal(parseIdentityProposal("désolé, je n'ai rien trouvé", OPTIONS), null);
  assert.equal(parseIdentityProposal(null, OPTIONS), null);
});

test("isProposalUseful — une proposition vide n'est pas montrée", () => {
  assert.equal(isProposalUseful(null), false);
  assert.equal(isProposalUseful({ canaux: [], offres: [], gaps: ["rien trouvé"] }), false);
  assert.equal(isProposalUseful({ canaux: ["Google"], offres: [], gaps: [] }), true);
  assert.equal(isProposalUseful({ canaux: [], offres: [], gaps: [], zone: "Paris" }), true);
});
