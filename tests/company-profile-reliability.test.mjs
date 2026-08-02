import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [openAi, profile, wizard] = await Promise.all([
  readFile(new URL("../lib/research/openai-search.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/research/company-profile.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../app/onboarding/identite/_components/identity-wizard.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
]);

test("company_profile — OpenAI rend le même schéma strict que le laboratoire", () => {
  assert.match(
    openAi,
    /args\.kind === "website_preview" \|\| args\.kind === "company_profile"/,
  );
  assert.match(openAi, /format: identityProposalTextFormat\(\)/);
});

test("company_profile — exploite le résultat structuré sans seconde recherche", () => {
  assert.equal(profile.match(/await runResearch\(/g)?.length, 1);
  assert.match(profile, /const proposal = parseUsefulProposal\(research\.text\)/);
  assert.match(profile, /markCompanyProfileUnusable/);
  assert.doesNotMatch(profile, /askOpenAiSearch|askPerplexity|generateText|withLlmTrace/);
  assert.doesNotMatch(profile, /\.from\(["']company_memory["']\)/);
});

test("onboarding — un timeout n'entraîne aucun essai automatique", () => {
  assert.match(wizard, /Aucun nouvel essai automatique n'a été lancé/);
  assert.doesNotMatch(wizard, /setTimeout\([^)]*proposeIdentity|retry/i);
});
