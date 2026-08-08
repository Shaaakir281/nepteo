/** Contrats purs CAMP-1 — aucune I/O, aucun fournisseur, aucune exécution. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_FORMATS_BY_CHANNEL,
  CAMPAIGN_STUDIO_PROPOSAL_VERSION,
  createInitialCampaignStudioDraft,
  deriveCampaignStudioBudgets,
  deriveCampaignStudioProposal,
  deriveExpectedCampaignFormats,
  validateCampaignStudioIntent,
} from "../lib/campaign-studio.ts";

const hookA = "Une preuve concrète pour prendre une décision sereine.";
const hookB = "Un audit clair avant d'investir davantage dans votre acquisition.";

const adSet = (overrides = {}) => ({
  id: "adset_main",
  name: "Audience du brief",
  objective: "new_customers",
  audience: "Dirigeants de PME industrielles en France",
  hypothesis: "Une preuve client concrète augmentera les demandes",
  strategy: "brief_audience",
  allocationBps: 10_000,
  ...overrides,
});

const validIntent = (overrides = {}) => ({
  proposalVersion: CAMPAIGN_STUDIO_PROPOSAL_VERSION,
  adSets: [adSet()],
  hooks: [hookA, hookB],
  selectedHookIndices: [0],
  ...overrides,
});

function issuePaths(result) {
  assert.equal(result.ok, false);
  return result.issues.map((issue) => issue.path);
}

test("CAMP-1 initial — un seul adset reprend le brief sans audience inventée", () => {
  const draft = createInitialCampaignStudioDraft(
    {
      objective: "new_customers",
      audience: "Dirigeants de PME industrielles en France",
      hypothesis: "Une preuve client concrète augmentera les demandes",
    },
    [hookA, hookB],
  );

  assert.equal(draft.proposalVersion, 2);
  assert.equal(draft.adSets.length, 1);
  assert.deepEqual(draft.adSets[0], adSet());
  assert.deepEqual(draft.hooks, [hookA, hookB]);
  assert.deepEqual(
    draft.selectedHookIndices,
    [],
    "aucun hook engageant n'est présélectionné",
  );
});

test("CAMP-1 version — seule la version 2 est acceptée", () => {
  assert.equal(validateCampaignStudioIntent(validIntent()).ok, true);
  assert.ok(issuePaths(validateCampaignStudioIntent(validIntent({ proposalVersion: 1 }))).includes("proposalVersion"));
  assert.ok(issuePaths(validateCampaignStudioIntent(validIntent({ proposalVersion: "2" }))).includes("proposalVersion"));
});

test("CAMP-1 adsets — entre un et cinq ensembles", () => {
  assert.ok(issuePaths(validateCampaignStudioIntent(validIntent({ adSets: [] }))).includes("adSets"));

  const five = Array.from({ length: 5 }, (_, index) =>
    adSet({
      id: `adset_${index + 1}`,
      allocationBps: 2_000,
    }),
  );
  assert.equal(validateCampaignStudioIntent(validIntent({ adSets: five })).ok, true);

  const six = Array.from({ length: 6 }, (_, index) =>
    adSet({
      id: `adset_${index + 1}`,
      allocationBps: index < 5 ? 1_667 : 1_665,
    }),
  );
  assert.ok(issuePaths(validateCampaignStudioIntent(validIntent({ adSets: six }))).includes("adSets"));
});

test("CAMP-1 adsets — UUID ou token stable, identifiants uniques", () => {
  const uuid = "8d6da793-7c7a-4c2e-bdd4-e132f2d42224";
  assert.equal(
    validateCampaignStudioIntent(validIntent({ adSets: [adSet({ id: uuid })] })).ok,
    true,
  );

  for (const id of ["x", "avec espace", `a${"b".repeat(64)}`, "1_commence_mal"] ) {
    assert.ok(
      issuePaths(
        validateCampaignStudioIntent(validIntent({ adSets: [adSet({ id })] })),
      ).includes("adSets.0.id"),
    );
  }

  const duplicate = validateCampaignStudioIntent(
    validIntent({
      adSets: [
        adSet({ id: "adset_same", allocationBps: 5_000 }),
        adSet({ id: "ADSET_SAME", allocationBps: 5_000 }),
      ],
    }),
  );
  assert.ok(issuePaths(duplicate).includes("adSets.1.id"));
});

test("CAMP-1 adsets — listes, textes, basis points et somme sont validés", () => {
  const invalid = validateCampaignStudioIntent(
    validIntent({
      adSets: [
        adSet({
          name: "x",
          objective: "invented",
          audience: "x",
          hypothesis: "court",
          strategy: "lookalike_invented",
          allocationBps: 5_000.5,
        }),
      ],
    }),
  );
  const paths = issuePaths(invalid);
  for (const path of [
    "adSets.0.name",
    "adSets.0.objective",
    "adSets.0.audience",
    "adSets.0.hypothesis",
    "adSets.0.strategy",
    "adSets.0.allocationBps",
    "adSets",
  ]) {
    assert.ok(paths.includes(path), path);
  }

  const wrongTotal = validateCampaignStudioIntent(
    validIntent({
      adSets: [
        adSet({ id: "adset_a", allocationBps: 4_000 }),
        adSet({ id: "adset_b", allocationBps: 5_999 }),
      ],
    }),
  );
  assert.ok(issuePaths(wrongTotal).includes("adSets"));

  const cleaned = validateCampaignStudioIntent(
    validIntent({
      adSets: [
        adSet({
          name: "  Audience\n principale ",
          audience: "  Dirigeants\t de PME  ",
        }),
      ],
    }),
  );
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.value.adSets[0].name, "Audience principale");
  assert.equal(cleaned.value.adSets[0].audience, "Dirigeants de PME");
});

test("CAMP-1 budgets — somme exacte et centimes répartis déterministement", () => {
  const allocations = [
    adSet({ id: "adset_a", allocationBps: 3_333 }),
    adSet({ id: "adset_b", allocationBps: 3_333 }),
    adSet({ id: "adset_c", allocationBps: 3_334 }),
  ];
  const result = deriveCampaignStudioBudgets(allocations, 35);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.map(({ id, budgetCents }) => [id, budgetCents]),
    [
      ["adset_a", 1_167],
      ["adset_b", 1_166],
      ["adset_c", 1_167],
    ],
  );
  assert.equal(
    result.value.reduce((sum, item) => sum + item.budgetCents, 0),
    3_500,
  );
  assert.equal(result.totalBudget, 35);
  assert.deepEqual(
    result.value.map(({ allocationPercent }) => allocationPercent),
    [33.33, 33.33, 33.34],
  );

  const reordered = deriveCampaignStudioBudgets(
    [allocations[1], allocations[0], allocations[2]],
    35,
  );
  assert.equal(reordered.ok, true);
  assert.deepEqual(
    Object.fromEntries(result.value.map(({ id, budgetCents }) => [id, budgetCents])),
    Object.fromEntries(reordered.value.map(({ id, budgetCents }) => [id, budgetCents])),
  );
});

test("CAMP-1 budgets — budget serveur et allocations invalides échouent fermés", () => {
  for (const total of [34.99, 30_000.01, 100.001, Number.NaN]) {
    assert.deepEqual(deriveCampaignStudioBudgets([adSet()], total), {
      ok: false,
      error: "invalid_server_total_budget",
    });
  }
  assert.deepEqual(
    deriveCampaignStudioBudgets(
      [
        adSet({ id: "adset_a", allocationBps: 5_000 }),
        adSet({ id: "adset_b", allocationBps: 4_999 }),
      ],
      100,
    ),
    { ok: false, error: "invalid_adset_allocations" },
  );
});

test("CAMP-1 hooks — deux à six textes nettoyés, bornés et uniques", () => {
  const cleaned = validateCampaignStudioIntent(
    validIntent({ hooks: [`  ${hookA}\n`, hookB] }),
  );
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.value.hooks[0], hookA);

  for (const hooks of [
    [hookA],
    Array.from({ length: 7 }, (_, index) => `${hookA} ${index}`),
    ["court", hookB],
    ["x".repeat(501), hookB],
    [hookA, `  ${hookA.toUpperCase()}  `],
  ]) {
    assert.ok(issuePaths(validateCampaignStudioIntent(validIntent({ hooks }))).some((path) => path.startsWith("hooks")));
  }
});

test("CAMP-1 sélection — au moins un index unique et valide, ordre canonique", () => {
  for (const selectedHookIndices of [[], [-1], [2], [0, 0], [0.5], ["0"]]) {
    assert.ok(
      issuePaths(
        validateCampaignStudioIntent(validIntent({ selectedHookIndices })),
      ).some((path) => path.startsWith("selectedHookIndices")),
    );
  }

  const valid = validateCampaignStudioIntent(
    validIntent({ selectedHookIndices: [1, 0] }),
  );
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value.selectedHookIndices, [0, 1]);
});

test("CAMP-1 formats — allowlist dérivée uniquement du canal serveur", () => {
  assert.deepEqual(
    deriveExpectedCampaignFormats("meta").map(({ value }) => value),
    CAMPAIGN_FORMATS_BY_CHANNEL.meta.map(({ value }) => value),
  );
  assert.deepEqual(deriveExpectedCampaignFormats("unknown"), []);

  const untrustedInput = {
    ...validIntent(),
    expectedFormats: [{ value: "provider_mutation", label: "À ignorer" }],
    adSets: [
      {
        ...adSet(),
        budget: 999_999,
        budgetCents: 99_999_900,
      },
    ],
  };
  const proposal = deriveCampaignStudioProposal(untrustedInput, {
    totalBudget: 280,
    channel: "linkedin",
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.value.adSets[0].budget, 280);
  assert.deepEqual(
    proposal.value.expectedFormats.map(({ value }) => value),
    ["sponsored_content"],
  );
  assert.equal(
    proposal.value.expectedFormats.some(({ value }) => value === "provider_mutation"),
    false,
  );

  const invalidChannel = deriveCampaignStudioProposal(validIntent(), {
    totalBudget: 280,
    channel: "unknown",
  });
  assert.ok(issuePaths(invalidChannel).includes("channel"));
});
