/**
 * Tests de la recherche web (Perplexity) — parties pures uniquement.
 * Runner : node:test. Node ≥ 22. Aucun appel réseau : on teste les requêtes,
 * la clé de cache, les garde-fous et la lecture de la réponse.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompanyQuery,
  buildProspectCompanyQuery,
  cleanWebsite,
  guardResearch,
  isFresh,
  MAX_RESEARCH_PER_DAY,
  MAX_SOURCES,
  parseResearchResponse,
  renderResearch,
  subjectKey,
} from "../lib/research/research-rules.ts";

test("subjectKey — même société, même clé (on ne paie pas deux fois)", () => {
  const expected = "acme-corp-fr";
  assert.equal(subjectKey("https://www.Acme-Corp.fr/contact?x=1"), expected);
  assert.equal(subjectKey("  ACME-corp.fr  "), expected);
  assert.equal(subjectKey("http://acme-corp.fr#top"), expected);
  // Accents et ponctuation normalisés.
  assert.equal(subjectKey("Créations Dupré & Fils"), "creations-dupre-fils");
  // Rien d'exploitable.
  assert.equal(subjectKey("   "), "");
  assert.equal(subjectKey("!!!"), "");
  assert.equal(subjectKey(null), "");
  assert.equal(subjectKey(42), "");
});

test("cleanWebsite — accepte un domaine nu, refuse le reste", () => {
  assert.equal(cleanWebsite("acme.fr"), "https://acme.fr/");
  assert.equal(cleanWebsite("https://acme.fr/a"), "https://acme.fr/a");
  assert.equal(cleanWebsite("javascript:alert(1)"), "");
  assert.equal(cleanWebsite("localhost"), "");
  assert.equal(cleanWebsite(""), "");
  assert.equal(cleanWebsite(null), "");
});

test("buildCompanyQuery — nom obligatoire, site et activité optionnels", () => {
  const full = buildCompanyQuery({
    name: "Menuiseries Dupré",
    website: "dupre.fr",
    activity: "fenêtres sur mesure",
  });
  assert.ok(full.includes("Menuiseries Dupré"));
  assert.ok(full.includes("https://dupre.fr/"));
  assert.ok(full.includes("fenêtres sur mesure"));
  // Consigne anti-hallucination : une identité fausse contaminerait tout l'aval.
  assert.ok(full.includes("N'invente rien"));

  const minimal = buildCompanyQuery({ name: "Acme" });
  assert.ok(minimal.includes("Acme"));
  assert.ok(!minimal.includes("site officiel"));
  assert.ok(!minimal.includes("activité déclarée"));
});

test("buildProspectCompanyQuery — interdit explicitement les personnes (RGPD)", () => {
  const q = buildProspectCompanyQuery({ company: "Bâti Nord" });
  assert.ok(q.includes("Bâti Nord"));
  assert.ok(q.includes("aucune information"));
  assert.ok(q.includes("personnes physiques"));
});

test("guardResearch — ordre de priorité des garde-fous", () => {
  const base = { hasKey: true, paused: false, subject: "acme", usedToday: 0 };
  assert.deepEqual(guardResearch(base), { ok: true });

  // Pas de clé : prime sur tout le reste.
  assert.deepEqual(
    guardResearch({ ...base, hasKey: false, paused: true, usedToday: 999 }),
    { ok: false, reason: "no_key" },
  );
  // Bouton d'arrêt : prime sur le sujet et le plafond.
  assert.deepEqual(
    guardResearch({ ...base, paused: true, subject: "", usedToday: 999 }),
    { ok: false, reason: "paused" },
  );
  assert.deepEqual(guardResearch({ ...base, subject: "  " }), {
    ok: false,
    reason: "no_subject",
  });
  assert.deepEqual(
    guardResearch({ ...base, usedToday: MAX_RESEARCH_PER_DAY }),
    { ok: false, reason: "daily_cap" },
  );
  // La dernière recherche sous le plafond passe encore.
  assert.deepEqual(
    guardResearch({ ...base, usedToday: MAX_RESEARCH_PER_DAY - 1 }),
    { ok: true },
  );
  // Plafond abaissé pour un appelant particulier.
  assert.deepEqual(guardResearch({ ...base, usedToday: 2, maxPerDay: 2 }), {
    ok: false,
    reason: "daily_cap",
  });
});

test("isFresh — cache valable, périmé, ou date illisible", () => {
  const now = new Date("2026-07-25T12:00:00Z");
  assert.equal(isFresh("2026-07-20T12:00:00Z", now), true);
  assert.equal(isFresh("2026-05-01T12:00:00Z", now), false);
  assert.equal(isFresh("pas une date", now), false);
  // Une date dans le futur est suspecte : on ne s'y fie pas.
  assert.equal(isFresh("2027-01-01T00:00:00Z", now), false);
  // Fenêtre explicite.
  assert.equal(isFresh("2026-07-23T12:00:00Z", now, 1), false);
  assert.equal(isFresh("2026-07-25T00:00:00Z", now, 1), true);
});

test("parseResearchResponse — forme Agent API (output[])", () => {
  const answer = parseResearchResponse({
    output: [
      {
        type: "search_results",
        results: [
          { title: "Site officiel", url: "https://acme.fr", date: "2026-06-14" },
          { title: "Doublon", url: "https://acme.fr" },
          { url: "https://avis.fr" },
        ],
      },
      {
        type: "message",
        content: [{ type: "output_text", text: "Acme vend des fenêtres." }],
      },
    ],
  });
  assert.equal(answer.text, "Acme vend des fenêtres.");
  assert.equal(answer.sources.length, 2, "les doublons d'URL sont écartés");
  assert.deepEqual(answer.sources[0], {
    title: "Site officiel",
    url: "https://acme.fr",
    date: "2026-06-14",
  });
  // Sans titre, l'URL fait office de libellé.
  assert.equal(answer.sources[1].title, "https://avis.fr");
});

test("parseResearchResponse — repli sur la forme Sonar, et bornage des sources", () => {
  const answer = parseResearchResponse({
    choices: [{ message: { content: "Réponse Sonar." } }],
    search_results: Array.from({ length: MAX_SOURCES + 4 }, (_, i) => ({
      title: `S${i}`,
      url: `https://s${i}.fr`,
    })),
  });
  assert.equal(answer.text, "Réponse Sonar.");
  assert.equal(answer.sources.length, MAX_SOURCES);
});

test("parseResearchResponse — ne lève jamais sur une réponse inattendue", () => {
  assert.deepEqual(parseResearchResponse(null), { text: "", sources: [] });
  assert.deepEqual(parseResearchResponse("oops"), { text: "", sources: [] });
  assert.deepEqual(parseResearchResponse({}), { text: "", sources: [] });
  assert.deepEqual(parseResearchResponse({ output: "pas un tableau" }), {
    text: "",
    sources: [],
  });
  assert.deepEqual(parseResearchResponse({ output: [{ type: "message" }] }), {
    text: "",
    sources: [],
  });
});

test("renderResearch — vide sans résultat (prompt inchangé), sinon texte + sources", () => {
  assert.equal(renderResearch(null), "");
  assert.equal(renderResearch({ text: "   ", sources: [] }), "");
  assert.equal(renderResearch({ text: "Fait.", sources: [] }), "Fait.");
  assert.equal(
    renderResearch({ text: "Fait.", sources: [{ title: "t", url: "https://a.fr" }] }),
    "Fait.\n\nSources : https://a.fr",
  );
});
