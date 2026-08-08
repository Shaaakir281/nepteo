/**
 * Contrat pur CAMP-1 du studio de proposition.
 *
 * Ce module n'effectue aucune I/O. Il valide uniquement l'intention éditable
 * de l'utilisateur. Les budgets et formats sont ajoutés depuis des faits
 * serveur séparés : le navigateur ne peut donc pas les imposer.
 */

import {
  CAMPAIGN_BUDGET_LIMITS,
  CAMPAIGN_DURATIONS,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_TEXT_LIMITS,
  cleanCampaignText,
  type CampaignBrief,
} from "./campaign-plan.ts";

export const CAMPAIGN_STUDIO_PROPOSAL_VERSION = 2 as const;

export const CAMPAIGN_STUDIO_LIMITS = Object.freeze({
  adSets: Object.freeze({ min: 1, max: 5 }),
  adSetId: Object.freeze({ min: 3, max: 64 }),
  adSetName: Object.freeze({ min: 3, max: 100 }),
  hooks: Object.freeze({ min: 2, max: 6 }),
  hookText: Object.freeze({ min: 10, max: 500 }),
  allocationBps: Object.freeze({ min: 1, max: 10_000, total: 10_000 }),
});

export const CAMPAIGN_STUDIO_TOTAL_BUDGET_LIMITS = Object.freeze({
  min: CAMPAIGN_BUDGET_LIMITS.min * Math.min(...CAMPAIGN_DURATIONS),
  max: CAMPAIGN_BUDGET_LIMITS.max * Math.max(...CAMPAIGN_DURATIONS),
});

export const CAMPAIGN_AUDIENCE_STRATEGIES = [
  { value: "brief_audience", label: "Audience décrite dans le brief" },
  { value: "high_intent_visitors", label: "Visiteurs à forte intention" },
  { value: "recent_trials", label: "Essais récents" },
  { value: "broad_signals", label: "Audience large guidée par les signaux" },
  { value: "social_engagers", label: "Personnes engagées sur les réseaux" },
  { value: "video_viewers", label: "Personnes ayant vu une vidéo" },
] as const;

export type CampaignAudienceStrategy =
  (typeof CAMPAIGN_AUDIENCE_STRATEGIES)[number]["value"];

/**
 * Formats produit prudents. Ils décrivent les familles attendues sans prétendre
 * qu'un placement fournisseur a déjà été préparé ou validé.
 */
export const CAMPAIGN_FORMATS_BY_CHANNEL = Object.freeze({
  meta: Object.freeze([
    Object.freeze({ value: "feed", label: "Fil d'actualité" }),
    Object.freeze({ value: "story", label: "Story" }),
  ]),
  google: Object.freeze([
    Object.freeze({ value: "responsive_ad", label: "Annonce responsive" }),
  ]),
  linkedin: Object.freeze([
    Object.freeze({ value: "sponsored_content", label: "Contenu sponsorisé" }),
  ]),
});

export type CampaignStudioChannel = keyof typeof CAMPAIGN_FORMATS_BY_CHANNEL;
export type CampaignExpectedFormat =
  (typeof CAMPAIGN_FORMATS_BY_CHANNEL)[CampaignStudioChannel][number];

export interface CampaignStudioAdSet {
  id: string;
  name: string;
  objective: string;
  audience: string;
  hypothesis: string;
  strategy: CampaignAudienceStrategy;
  allocationBps: number;
}

export interface CampaignStudioIntent {
  proposalVersion: typeof CAMPAIGN_STUDIO_PROPOSAL_VERSION;
  adSets: CampaignStudioAdSet[];
  hooks: string[];
  selectedHookIndices: number[];
}

/** Un brouillon peut être incomplet avant la sélection explicite d'un hook. */
export interface CampaignStudioDraft {
  proposalVersion: typeof CAMPAIGN_STUDIO_PROPOSAL_VERSION;
  adSets: CampaignStudioAdSet[];
  hooks: string[];
  selectedHookIndices: number[];
}

export interface CampaignStudioAdSetBudget extends CampaignStudioAdSet {
  allocationPercent: number;
  budgetCents: number;
  budget: number;
}

export interface CampaignStudioProposal {
  proposalVersion: typeof CAMPAIGN_STUDIO_PROPOSAL_VERSION;
  adSets: CampaignStudioAdSetBudget[];
  hooks: string[];
  selectedHookIndices: number[];
  expectedFormats: CampaignExpectedFormat[];
}

export interface CampaignStudioValidationIssue {
  path: string;
  message: string;
}

export type CampaignStudioIntentValidation =
  | { ok: true; value: CampaignStudioIntent }
  | { ok: false; issues: CampaignStudioValidationIssue[] };

export type CampaignStudioBudgetDerivation =
  | {
      ok: true;
      value: CampaignStudioAdSetBudget[];
      totalBudget: number;
      totalBudgetCents: number;
    }
  | { ok: false; error: string };

export type CampaignStudioProposalDerivation =
  | { ok: true; value: CampaignStudioProposal }
  | { ok: false; issues: CampaignStudioValidationIssue[] };

const objectiveValues = new Set(
  CAMPAIGN_OBJECTIVES.map(({ value }) => value as string),
);
const strategyValues = new Set(
  CAMPAIGN_AUDIENCE_STRATEGIES.map(({ value }) => value as string),
);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STABLE_TOKEN_PATTERN = /^[a-z][a-z0-9_-]{2,63}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boundedText(
  value: unknown,
  path: string,
  limits: { min: number; max: number },
  issues: CampaignStudioValidationIssue[],
): string {
  const cleaned = cleanCampaignText(value);
  if (cleaned.length < limits.min) {
    issues.push({
      path,
      message: `Minimum ${limits.min} caractères.`,
    });
  } else if (cleaned.length > limits.max) {
    issues.push({
      path,
      message: `Maximum ${limits.max} caractères.`,
    });
  }
  return cleaned;
}

function canonicalAdSetId(value: unknown): string {
  return cleanCampaignText(value).toLowerCase();
}

function isValidAdSetId(value: string): boolean {
  return (
    value.length >= CAMPAIGN_STUDIO_LIMITS.adSetId.min &&
    value.length <= CAMPAIGN_STUDIO_LIMITS.adSetId.max &&
    (UUID_PATTERN.test(value) || STABLE_TOKEN_PATTERN.test(value))
  );
}

function canonicalHookKey(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

/**
 * Crée la structure la plus prudente possible : un seul adset reprenant
 * strictement l'objectif et l'audience du brief, sans segment inventé.
 * Aucun hook n'est présélectionné.
 */
export function createInitialCampaignStudioDraft(
  brief: Pick<CampaignBrief, "objective" | "audience" | "hypothesis">,
  hooks: readonly string[] = [],
): CampaignStudioDraft {
  return {
    proposalVersion: CAMPAIGN_STUDIO_PROPOSAL_VERSION,
    adSets: [
      {
        id: "adset_main",
        name: "Audience du brief",
        objective: cleanCampaignText(brief.objective),
        audience: cleanCampaignText(brief.audience),
        hypothesis: cleanCampaignText(brief.hypothesis),
        strategy: "brief_audience",
        allocationBps: CAMPAIGN_STUDIO_LIMITS.allocationBps.total,
      },
    ],
    hooks: hooks.map(cleanCampaignText),
    selectedHookIndices: [],
  };
}

/** Valide et canonise toute l'intention éditable reçue du navigateur. */
export function validateCampaignStudioIntent(
  input: unknown,
): CampaignStudioIntentValidation {
  const raw = asRecord(input);
  const issues: CampaignStudioValidationIssue[] = [];

  if (raw.proposalVersion !== CAMPAIGN_STUDIO_PROPOSAL_VERSION) {
    issues.push({
      path: "proposalVersion",
      message: `Version attendue : ${CAMPAIGN_STUDIO_PROPOSAL_VERSION}.`,
    });
  }

  const rawAdSets = Array.isArray(raw.adSets) ? raw.adSets : [];
  if (
    rawAdSets.length < CAMPAIGN_STUDIO_LIMITS.adSets.min ||
    rawAdSets.length > CAMPAIGN_STUDIO_LIMITS.adSets.max
  ) {
    issues.push({
      path: "adSets",
      message: `Conservez entre ${CAMPAIGN_STUDIO_LIMITS.adSets.min} et ${CAMPAIGN_STUDIO_LIMITS.adSets.max} ensembles de publicités.`,
    });
  }

  const adSets: CampaignStudioAdSet[] = [];
  const seenAdSetIds = new Set<string>();
  for (const [index, item] of rawAdSets.entries()) {
    const path = `adSets.${index}`;
    const adSet = asRecord(item);
    const id = canonicalAdSetId(adSet.id);
    if (!isValidAdSetId(id)) {
      issues.push({
        path: `${path}.id`,
        message: "Utilisez un UUID ou un identifiant stable de 3 à 64 caractères.",
      });
    } else if (seenAdSetIds.has(id)) {
      issues.push({
        path: `${path}.id`,
        message: "Chaque ensemble doit avoir un identifiant unique.",
      });
    }
    seenAdSetIds.add(id);

    const name = boundedText(
      adSet.name,
      `${path}.name`,
      CAMPAIGN_STUDIO_LIMITS.adSetName,
      issues,
    );
    const objective = cleanCampaignText(adSet.objective);
    if (!objectiveValues.has(objective)) {
      issues.push({
        path: `${path}.objective`,
        message: "Choisissez un objectif de campagne autorisé.",
      });
    }
    const audience = boundedText(
      adSet.audience,
      `${path}.audience`,
      CAMPAIGN_TEXT_LIMITS.audience,
      issues,
    );
    const hypothesis = boundedText(
      adSet.hypothesis,
      `${path}.hypothesis`,
      CAMPAIGN_TEXT_LIMITS.hypothesis,
      issues,
    );
    const strategy = cleanCampaignText(adSet.strategy);
    if (!strategyValues.has(strategy)) {
      issues.push({
        path: `${path}.strategy`,
        message: "Choisissez une stratégie d'audience autorisée.",
      });
    }
    const allocationBps = adSet.allocationBps;
    if (
      typeof allocationBps !== "number" ||
      !Number.isInteger(allocationBps) ||
      allocationBps < CAMPAIGN_STUDIO_LIMITS.allocationBps.min ||
      allocationBps > CAMPAIGN_STUDIO_LIMITS.allocationBps.max
    ) {
      issues.push({
        path: `${path}.allocationBps`,
        message: "L'allocation doit être un nombre entier de basis points entre 1 et 10 000.",
      });
    }

    adSets.push({
      id,
      name,
      objective,
      audience,
      hypothesis,
      strategy: strategy as CampaignAudienceStrategy,
      allocationBps:
        typeof allocationBps === "number" ? allocationBps : Number.NaN,
    });
  }

  const allocationTotal = adSets.reduce(
    (sum, adSet) => sum + adSet.allocationBps,
    0,
  );
  if (
    rawAdSets.length > 0 &&
    (!Number.isFinite(allocationTotal) ||
      allocationTotal !== CAMPAIGN_STUDIO_LIMITS.allocationBps.total)
  ) {
    issues.push({
      path: "adSets",
      message: "La somme des allocations doit être exactement égale à 10 000 basis points.",
    });
  }

  const rawHooks = Array.isArray(raw.hooks) ? raw.hooks : [];
  if (
    rawHooks.length < CAMPAIGN_STUDIO_LIMITS.hooks.min ||
    rawHooks.length > CAMPAIGN_STUDIO_LIMITS.hooks.max
  ) {
    issues.push({
      path: "hooks",
      message: `Conservez entre ${CAMPAIGN_STUDIO_LIMITS.hooks.min} et ${CAMPAIGN_STUDIO_LIMITS.hooks.max} hooks.`,
    });
  }
  const hooks: string[] = [];
  const seenHooks = new Set<string>();
  for (const [index, item] of rawHooks.entries()) {
    const hook = boundedText(
      item,
      `hooks.${index}`,
      CAMPAIGN_STUDIO_LIMITS.hookText,
      issues,
    );
    const key = canonicalHookKey(hook);
    if (key && seenHooks.has(key)) {
      issues.push({
        path: `hooks.${index}`,
        message: "Chaque hook doit être unique.",
      });
    }
    if (key) seenHooks.add(key);
    hooks.push(hook);
  }

  const rawSelection = Array.isArray(raw.selectedHookIndices)
    ? raw.selectedHookIndices
    : [];
  if (rawSelection.length === 0) {
    issues.push({
      path: "selectedHookIndices",
      message: "Sélectionnez au moins un hook.",
    });
  }
  const selectedHookIndices: number[] = [];
  const seenIndices = new Set<number>();
  for (const [index, item] of rawSelection.entries()) {
    if (
      typeof item !== "number" ||
      !Number.isInteger(item) ||
      item < 0 ||
      item >= hooks.length
    ) {
      issues.push({
        path: `selectedHookIndices.${index}`,
        message: "L'index de hook sélectionné est invalide.",
      });
      continue;
    }
    if (seenIndices.has(item)) {
      issues.push({
        path: `selectedHookIndices.${index}`,
        message: "Un hook ne peut être sélectionné qu'une fois.",
      });
      continue;
    }
    seenIndices.add(item);
    selectedHookIndices.push(item);
  }
  selectedHookIndices.sort((left, right) => left - right);

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      proposalVersion: CAMPAIGN_STUDIO_PROPOSAL_VERSION,
      adSets,
      hooks,
      selectedHookIndices,
    },
  };
}

/**
 * Répartit exactement le budget serveur en centimes selon les basis points.
 * Les restes vont d'abord aux fractions les plus fortes, puis à l'identifiant
 * lexicalement le plus petit : le résultat ne dépend pas de l'ordre des lignes.
 */
export function deriveCampaignStudioBudgets(
  adSets: readonly CampaignStudioAdSet[],
  serverTotalBudget: number,
): CampaignStudioBudgetDerivation {
  const scaledBudget = serverTotalBudget * 100;
  const totalBudgetCents = Math.round(scaledBudget);
  if (
    !Number.isFinite(serverTotalBudget) ||
    serverTotalBudget < CAMPAIGN_STUDIO_TOTAL_BUDGET_LIMITS.min ||
    serverTotalBudget > CAMPAIGN_STUDIO_TOTAL_BUDGET_LIMITS.max ||
    !Number.isSafeInteger(totalBudgetCents) ||
    Math.abs(scaledBudget - totalBudgetCents) > 1e-7
  ) {
    return { ok: false, error: "invalid_server_total_budget" };
  }
  if (
    adSets.length < CAMPAIGN_STUDIO_LIMITS.adSets.min ||
    adSets.length > CAMPAIGN_STUDIO_LIMITS.adSets.max ||
    adSets.some(
      (adSet) =>
        !isValidAdSetId(adSet.id) ||
        !Number.isInteger(adSet.allocationBps) ||
        adSet.allocationBps < CAMPAIGN_STUDIO_LIMITS.allocationBps.min ||
        adSet.allocationBps > CAMPAIGN_STUDIO_LIMITS.allocationBps.max,
    ) ||
    new Set(adSets.map((adSet) => adSet.id)).size !== adSets.length ||
    adSets.reduce((sum, adSet) => sum + adSet.allocationBps, 0) !==
      CAMPAIGN_STUDIO_LIMITS.allocationBps.total
  ) {
    return { ok: false, error: "invalid_adset_allocations" };
  }

  const shares = adSets.map((adSet, index) => {
    const product = totalBudgetCents * adSet.allocationBps;
    return {
      index,
      id: adSet.id,
      cents: Math.floor(product / CAMPAIGN_STUDIO_LIMITS.allocationBps.total),
      remainder: product % CAMPAIGN_STUDIO_LIMITS.allocationBps.total,
    };
  });
  const allocatedCents = shares.reduce((sum, share) => sum + share.cents, 0);
  const remainingCents = totalBudgetCents - allocatedCents;
  const priorities = [...shares].sort((left, right) => {
    if (left.remainder !== right.remainder) {
      return right.remainder - left.remainder;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
  for (let index = 0; index < remainingCents; index += 1) {
    priorities[index].cents += 1;
  }

  const centsByIndex = new Map(
    shares.map((share) => [share.index, share.cents] as const),
  );
  // Les objets de `priorities` et `shares` sont les mêmes références ; la map
  // est construite après distribution et contient donc les centimes finaux.
  const value = adSets.map((adSet, index) => {
    const budgetCents = centsByIndex.get(index) ?? 0;
    return {
      ...adSet,
      allocationPercent: adSet.allocationBps / 100,
      budgetCents,
      budget: budgetCents / 100,
    };
  });

  return {
    ok: true,
    value,
    totalBudget: totalBudgetCents / 100,
    totalBudgetCents,
  };
}

/** Retourne une copie de l'allowlist associée au canal validé côté serveur. */
export function deriveExpectedCampaignFormats(
  serverChannel: unknown,
): CampaignExpectedFormat[] {
  const channel = cleanCampaignText(serverChannel);
  if (!Object.prototype.hasOwnProperty.call(CAMPAIGN_FORMATS_BY_CHANNEL, channel)) {
    return [];
  }
  return CAMPAIGN_FORMATS_BY_CHANNEL[
    channel as CampaignStudioChannel
  ].map((format) => ({ ...format })) as CampaignExpectedFormat[];
}

/**
 * Assemble la proposition depuis l'intention navigateur et les seuls faits
 * serveur autorisés. Tout champ `budget` ou `expectedFormats` ajouté à l'entrée
 * est ignoré, puis remplacé par la dérivation ci-dessous.
 */
export function deriveCampaignStudioProposal(
  input: unknown,
  serverFacts: { totalBudget: number; channel: unknown },
): CampaignStudioProposalDerivation {
  const validation = validateCampaignStudioIntent(input);
  if (!validation.ok) return validation;

  const budgets = deriveCampaignStudioBudgets(
    validation.value.adSets,
    serverFacts.totalBudget,
  );
  if (!budgets.ok) {
    return {
      ok: false,
      issues: [{ path: "totalBudget", message: budgets.error }],
    };
  }
  const expectedFormats = deriveExpectedCampaignFormats(serverFacts.channel);
  if (expectedFormats.length === 0) {
    return {
      ok: false,
      issues: [
        { path: "channel", message: "Le canal serveur n'est pas autorisé." },
      ],
    };
  }

  return {
    ok: true,
    value: {
      proposalVersion: CAMPAIGN_STUDIO_PROPOSAL_VERSION,
      adSets: budgets.value,
      hooks: validation.value.hooks,
      selectedHookIndices: validation.value.selectedHookIndices,
      expectedFormats,
    },
  };
}
