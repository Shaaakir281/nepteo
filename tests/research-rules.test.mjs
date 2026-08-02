/**
 * Tests de la recherche web (Perplexity et OpenAI) — parties pures uniquement.
 * Runner : node:test. Node ≥ 22. Aucun appel réseau : on teste les requêtes,
 * la clé de cache, les garde-fous et la lecture des réponses.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompanyQuery,
  buildProspectCompanyQuery,
  cleanWebsite,
  countWebSearchCalls,
  guardResearch,
  isFresh,
  MAX_SOURCES,
  openaiSearchContext,
  parseOpenAiSearchResponse,
  parseResearchResponse,
  readQuotaReservation,
  readQuotaUsage,
  researchAnswerLimit,
  researchTimeoutMs,
  renderResearch,
  sanitizeResearchSources,
  subjectKey,
} from "../lib/research/research-rules.ts";

test("propositions d'identité — conservent le JSON structuré au-delà de 4 000 caractères", () => {
  assert.equal(researchAnswerLimit("company_profile"), 12000);
  assert.equal(researchAnswerLimit("website_preview"), 12000);

  const longJson = JSON.stringify({ description: "x".repeat(5000) });
  const parsed = parseOpenAiSearchResponse(
    {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: longJson, annotations: [] }],
        },
      ],
    },
    researchAnswerLimit("website_preview"),
  );
  assert.equal(parsed.text, longJson);
  assert.doesNotThrow(() => JSON.parse(parsed.text));
});

test("timeout — les identités riches ont deux minutes sans allonger les fiches rapides", () => {
  assert.equal(researchTimeoutMs("company_profile"), 120000);
  assert.equal(researchTimeoutMs("website_preview"), 120000);
  assert.equal(researchTimeoutMs("prospect_company"), 45000);
});

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
  const base = { hasKey: true, subject: "acme" };
  assert.deepEqual(guardResearch(base), { ok: true });

  // Pas de clé : prime sur le sujet vide.
  assert.deepEqual(
    guardResearch({ ...base, hasKey: false, subject: "" }),
    { ok: false, reason: "no_key" },
  );
  assert.deepEqual(guardResearch({ ...base, subject: "  " }), {
    ok: false,
    reason: "no_subject",
  });
});

test("readQuotaReservation — valide strictement le contrat de la RPC", () => {
  assert.deepEqual(
    readQuotaReservation({ allowed: true, reason: null, used: 1 }),
    {
      allowed: true,
      reason: null,
      used: 1,
    },
  );
  assert.deepEqual(
    readQuotaReservation({ allowed: false, reason: "paused", used: 0 }),
    {
      allowed: false,
      reason: "paused",
      used: 0,
    },
  );
  assert.deepEqual(
    readQuotaReservation({
      allowed: false,
      reason: "daily_cap",
      used: 30,
    }),
    {
      allowed: false,
      reason: "daily_cap",
      used: 30,
    },
  );
  for (const value of [
    null,
    [],
    { allowed: true, used: 1 },
    { allowed: true, reason: "paused", used: 1 },
    { allowed: true, reason: null, used: 0 },
    { allowed: false, reason: null, used: 1 },
    { allowed: false, reason: "unknown", used: 1 },
    { allowed: false, reason: "paused", used: -1 },
    { allowed: false, reason: "daily_cap", used: 1.5 },
    { allowed: "true", reason: null, used: 1 },
    { allowed: true, reason: null, used: "1" },
  ]) {
    assert.equal(readQuotaReservation(value), null);
  }
});

test("readQuotaUsage — lecture non mutante et stricte du quota", () => {
  assert.equal(readQuotaUsage({ used: 0, usage_date: "2026-08-01" }), 0);
  assert.equal(readQuotaUsage({ used: 12 }), 12);
  for (const value of [null, [], {}, { used: -1 }, { used: 1.5 }, { used: "1" }]) {
    assert.equal(readQuotaUsage(value), null);
  }
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

/** Réponse OpenAI type : un `web_search_call` sourcé + un `message` annoté. */
function openAiPayload() {
  return {
    output: [
      {
        type: "web_search_call",
        id: "ws_1",
        status: "completed",
        action: {
          type: "search",
          query: "Menuiseries Dupré",
          sources: [
            { type: "url", url: "https://dupre.fr" },
            { type: "url", url: "https://annuaire.fr/dupre" },
          ],
        },
      },
      {
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: "Dupré fabrique des fenêtres sur mesure à Chartres.",
            annotations: [
              {
                type: "url_citation",
                start_index: 0,
                end_index: 12,
                url: "https://dupre.fr",
                title: "Site officiel",
              },
            ],
          },
        ],
      },
    ],
  };
}

test("parseOpenAiSearchResponse — texte, citations et pages consultées", () => {
  const answer = parseOpenAiSearchResponse(openAiPayload());
  assert.equal(answer.text, "Dupré fabrique des fenêtres sur mesure à Chartres.");
  // Sources vides = régression silencieuse : au moins une doit remonter.
  assert.ok(answer.sources.length >= 1);
  // La citation passe avant la liste exhaustive, et garde son titre.
  assert.deepEqual(answer.sources[0], {
    title: "Site officiel",
    url: "https://dupre.fr",
  });
  // L'URL consultée mais non citée complète, sans doublonner la citée.
  assert.equal(answer.sources.length, 2);
  assert.equal(answer.sources[1].url, "https://annuaire.fr/dupre");
  assert.equal(answer.sources[1].title, "https://annuaire.fr/dupre");
  // Les accents reviennent intacts (UTF-8, requêtes en français).
  assert.ok(answer.text.includes("fenêtres"));
});

test("parseOpenAiSearchResponse — sans `include`, le texte survit et les sources se réduisent aux citations", () => {
  const payload = openAiPayload();
  delete payload.output[0].action.sources;
  const answer = parseOpenAiSearchResponse(payload);
  assert.ok(answer.text);
  assert.equal(answer.sources.length, 1);
});

test("parseOpenAiSearchResponse — bornage à MAX_SOURCES et dédoublonnage", () => {
  const answer = parseOpenAiSearchResponse({
    output: [
      {
        type: "web_search_call",
        action: {
          type: "search",
          // Chaînes nues tolérées, et un doublon de la citation.
          sources: [
            "https://cite.fr",
            ...Array.from({ length: MAX_SOURCES + 4 }, (_, i) => ({
              url: `https://s${i}.fr`,
            })),
          ],
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Texte.",
            annotations: [{ type: "url_citation", url: "https://cite.fr", title: "Cité" }],
          },
        ],
      },
    ],
  });
  assert.equal(answer.sources.length, MAX_SOURCES);
  assert.equal(answer.sources[0].url, "https://cite.fr");
  assert.equal(
    answer.sources.filter((s) => s.url === "https://cite.fr").length,
    1,
    "une URL citée ET consultée ne compte qu'une fois",
  );
});

test("parseOpenAiSearchResponse — ne lève jamais, et n'annexe pas la forme Perplexity", () => {
  assert.deepEqual(parseOpenAiSearchResponse(null), { text: "", sources: [] });
  assert.deepEqual(parseOpenAiSearchResponse("oops"), { text: "", sources: [] });
  assert.deepEqual(parseOpenAiSearchResponse({}), { text: "", sources: [] });
  assert.deepEqual(parseOpenAiSearchResponse({ output: "pas un tableau" }), {
    text: "",
    sources: [],
  });
  // Annotations d'un autre type : ignorées, pas de source inventée.
  assert.deepEqual(
    parseOpenAiSearchResponse({
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "T.", annotations: [{ type: "file_citation" }] },
          ],
        },
      ],
    }),
    { text: "T.", sources: [] },
  );
});

test("les deux parseurs restent étanches (une forme ne se lit pas avec l'autre)", () => {
  const openAi = openAiPayload();
  // Le parseur Perplexity extrairait le TEXTE d'une réponse OpenAI mais pas ses
  // sources : c'est exactement la régression silencieuse qu'on veut éviter.
  assert.equal(parseResearchResponse(openAi).sources.length, 0);

  const perplexity = {
    output: [
      { type: "search_results", results: [{ title: "S", url: "https://p.fr" }] },
      { type: "message", content: [{ text: "Réponse." }] },
    ],
  };
  assert.equal(parseOpenAiSearchResponse(perplexity).sources.length, 0);
});

test("countWebSearchCalls — une requête ≠ une recherche facturée", () => {
  assert.equal(countWebSearchCalls(openAiPayload()), 1);
  assert.equal(
    countWebSearchCalls({
      output: [
        { type: "web_search_call" },
        { type: "web_search_call" },
        { type: "message", content: [] },
      ],
    }),
    2,
  );
  assert.equal(countWebSearchCalls(null), 0);
  assert.equal(countWebSearchCalls({ output: "nope" }), 0);
});

test("openaiSearchContext — profondeur bornée, la fiche prospect coûte le moins", () => {
  assert.equal(openaiSearchContext("company_profile"), "medium");
  assert.equal(openaiSearchContext("prospect_company"), "low");
  assert.equal(openaiSearchContext("website_preview"), "medium");
});

test("sources — seuls les liens HTTP(S) sans identifiants survivent", () => {
  assert.deepEqual(
    sanitizeResearchSources([
      { title: "Valide", url: "https://acme.fr/preuve" },
      { title: "Script", url: "javascript:alert(1)" },
      { title: "Identifiants", url: "https://user:pass@acme.fr" },
      { title: "Doublon", url: "https://acme.fr/preuve" },
    ]),
    [{ title: "Valide", url: "https://acme.fr/preuve" }],
  );
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
