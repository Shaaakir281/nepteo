/**
 * Tests du diagnostic de départ (étape 3 de l'onboarding enrichi) — parties pures.
 * Runner : node:test. Node ≥ 22.
 * Ce qui compte : le bon profil déduit, le bornage à trois canaux, la présence
 * d'un « ce qu'il vaut mieux éviter », et la reconnaissance de ce que
 * l'entreprise fait DÉJÀ (on ne lui apprend pas ce qu'elle pratique).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStarterDiagnostic,
  detectProfile,
  MAX_CHANNELS,
} from "../lib/diagnostic.ts";

const base = {
  activityType: "Services",
  audience: "Particuliers",
  zone: "Eure-et-Loir",
  offre: "fenêtres sur mesure",
  objectifs: ["Trouver plus de clients"],
  canauxActuels: [],
  presence: [],
};

test("detectProfile — reconnaît les quatre profils, et retombe sur un défaut", () => {
  assert.equal(detectProfile(base), "b2c_local");
  assert.equal(detectProfile({ ...base, audience: "Entreprises" }), "b2b");
  assert.equal(detectProfile({ ...base, activityType: "E-commerce" }), "ecommerce");
  assert.equal(
    detectProfile({ ...base, activityType: "SaaS ou application" }),
    "saas",
  );
  // L'e-commerce et le SaaS priment sur la clientèle : l'activité est plus discriminante.
  assert.equal(
    detectProfile({ ...base, activityType: "E-commerce", audience: "Entreprises" }),
    "ecommerce",
  );
  // Particuliers sans zone : ce n'est pas du local.
  assert.notEqual(detectProfile({ ...base, zone: "  " }), "b2c_local");
  assert.equal(
    detectProfile({ ...base, audience: "Collectivités ou associations", zone: "" }),
    "generic",
  );
});

test("diagnostic — borné à trois canaux, chacun complet", () => {
  for (const audience of ["Particuliers", "Entreprises"]) {
    for (const activityType of ["Services", "E-commerce", "SaaS ou application"]) {
      const d = buildStarterDiagnostic({ ...base, audience, activityType });
      assert.ok(d.channels.length >= 2, "au moins deux canaux");
      assert.ok(d.channels.length <= MAX_CHANNELS, "jamais plus de trois");
      for (const c of d.channels) {
        assert.ok(c.channel && c.why && c.firstStep, "canal complet");
        assert.ok(["Faible", "Moyen", "Élevé"].includes(c.effort));
        assert.ok(c.cost, "un ordre de coût est donné");
      }
    }
  }
});

test("diagnostic — dit toujours ce qu'il vaut mieux éviter, avec la raison", () => {
  for (const audience of ["Particuliers", "Entreprises"]) {
    const d = buildStarterDiagnostic({ ...base, audience });
    assert.ok(d.avoid.length >= 2, "au moins deux mises en garde");
    // Une mise en garde sans justification ne sert à rien.
    for (const a of d.avoid) assert.ok(a.length > 60, `justifiée : ${a}`);
  }
});

test("diagnostic — trois gestes pour la semaine, concrets", () => {
  const d = buildStarterDiagnostic(base);
  assert.equal(d.firstWeek.length, 3);
  for (const step of d.firstWeek) assert.ok(step.length > 30);
});

test("diagnostic — reconnaît ce qui est déjà en place (déclaré ou constaté)", () => {
  const vierge = buildStarterDiagnostic(base);
  assert.ok(vierge.channels.every((c) => !c.alreadyDoing));

  // Déclaré par l'utilisateur.
  const declare = buildStarterDiagnostic({
    ...base,
    canauxActuels: ["Recommandations", "Google"],
  });
  assert.ok(declare.channels.some((c) => c.alreadyDoing));

  // Constaté par la recherche web (section `presence`), accents ignorés.
  const constate = buildStarterDiagnostic({
    ...base,
    presence: ["Publicités Google actives sur « fenêtres »"],
  });
  assert.ok(constate.channels.some((c) => c.alreadyDoing));
});

test("diagnostic — l'intro cible ce qui n'est PAS encore fait", () => {
  const d = buildStarterDiagnostic(base);
  assert.ok(d.intro.includes("fenêtres sur mesure"));
  assert.ok(d.intro.includes("Eure-et-Loir"));

  // Tout est déjà couvert : on ne pousse pas un canal de plus pour faire nombre.
  const complet = buildStarterDiagnostic({
    ...base,
    canauxActuels: ["Google", "Publicité", "Recommandations"],
  });
  assert.ok(/déjà l'essentiel/.test(complet.intro), complet.intro);
});

test("diagnostic — expose son fondement pour pouvoir être contesté", () => {
  const d = buildStarterDiagnostic(base);
  assert.ok(d.basis.includes("Services"));
  assert.ok(d.basis.includes("Eure-et-Loir"));
  assert.ok(/Aucune donnée de campagne/.test(d.basis));

  // Identité vide : on le dit, on n'invente pas un fondement.
  const vide = buildStarterDiagnostic({
    activityType: "",
    audience: "",
    zone: "",
    offre: "",
    objectifs: [],
    canauxActuels: [],
    presence: [],
  });
  assert.ok(/Complétez votre fiche entreprise/.test(vide.basis));
  assert.ok(vide.channels.length >= 2, "un diagnostic générique reste utile");
});
