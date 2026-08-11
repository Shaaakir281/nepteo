export const WALKTHROUGH_STORAGE_KEY = "nepteo_walkthrough_v1";
export const WALKTHROUGH_UPDATED_EVENT = "nepteo:walkthrough-updated";
export const WALKTHROUGH_VERSION = 1;

export const WALKTHROUGH_PATHS = ["example", "real", "free"] as const;
export type WalkthroughPath = (typeof WALKTHROUGH_PATHS)[number];

export const WALKTHROUGH_SCENARIOS = ["artisan", "agence", "ecommerce"] as const;
export type WalkthroughScenario = (typeof WALKTHROUGH_SCENARIOS)[number];

export interface WalkthroughMission {
  id: string;
  stage: number;
  title: string;
  goal: string;
  href: string;
  action: string;
  optional?: boolean;
}

export interface WalkthroughState {
  version: typeof WALKTHROUGH_VERSION;
  path: WalkthroughPath;
  scenario?: WalkthroughScenario;
  completed: string[];
  updatedAt: string;
}

export interface WalkthroughStage {
  id: number;
  title: string;
  description: string;
}

export const WALKTHROUGH_STAGES: WalkthroughStage[] = [
  {
    id: 0,
    title: "Définir le contexte",
    description:
      "Comprendre les informations qui structurent les analyses et les propositions.",
  },
  {
    id: 1,
    title: "Analyser la situation",
    description:
      "Examiner les données disponibles et la synthèse préparée par l’agent.",
  },
  {
    id: 2,
    title: "Identifier une priorité",
    description:
      "Lire l’ordre des recommandations et les faits qui le justifient.",
  },
  {
    id: 3,
    title: "Prendre une décision",
    description:
      "Personnaliser une proposition, puis la valider, la reporter ou la refuser.",
  },
  {
    id: 4,
    title: "Contrôler l’exécution",
    description:
      "Vérifier l’historique et les commandes qui maintiennent l’agent sous contrôle.",
  },
];

export const WALKTHROUGH_MISSIONS: WalkthroughMission[] = [
  {
    id: "activity",
    stage: 0,
    title: "Décrivez votre activité",
    goal: "Repérez où Nepteo conserve vos offres, vos publics et votre vocabulaire.",
    href: "/entreprise?onglet=identite",
    action: "Ouvrir la fiche entreprise",
  },
  {
    id: "voice",
    stage: 0,
    title: "Définissez vos principes de communication",
    goal: "Vérifiez comment votre ton et vos limites encadrent les messages préparés.",
    href: "/entreprise?onglet=identite",
    action: "Examiner les principes",
  },
  {
    id: "website",
    stage: 0,
    title: "Testez l’enrichissement depuis un site",
    goal:
      "Évaluez l’extraction, les sources et les manques sans modifier automatiquement votre fiche.",
    href: "/entreprise/laboratoire-web",
    action: "Ouvrir le laboratoire web",
    optional: true,
  },
  {
    id: "situation",
    stage: 1,
    title: "Examinez les données disponibles",
    goal: "Identifiez ce que Nepteo peut analyser et ce qui manque encore.",
    href: "/entreprise?onglet=connecteurs",
    action: "Examiner les sources",
  },
  {
    id: "summary",
    stage: 1,
    title: "Consultez la synthèse de l’agent",
    goal: "Distinguez les faits observés des conseils et des éléments inconnus.",
    href: "/",
    action: "Ouvrir Aujourd’hui",
  },
  {
    id: "priorities",
    stage: 2,
    title: "Examinez les priorités du jour",
    goal: "Repérez les actions retenues et l’ordre proposé par Nepteo.",
    href: "/",
    action: "Voir la file À valider",
  },
  {
    id: "rationale",
    stage: 2,
    title: "Consultez « Pourquoi maintenant »",
    goal: "Vérifiez que chaque recommandation s’appuie sur des faits identifiables.",
    href: "/",
    action: "Examiner une recommandation",
  },
  {
    id: "customize",
    stage: 3,
    title: "Examinez et personnalisez la proposition",
    goal: "Contrôlez le raisonnement et le brouillon avant toute décision.",
    href: "/",
    action: "Ouvrir une proposition",
  },
  {
    id: "decide",
    stage: 3,
    title: "Validez, reportez ou refusez",
    goal: "Constatez que la décision finale vous appartient et qu’elle est enregistrée.",
    href: "/",
    action: "Voir les décisions possibles",
  },
  {
    id: "journal",
    stage: 4,
    title: "Contrôlez l’historique des actions",
    goal: "Retrouvez les analyses, préparations et décisions dans un historique vérifiable.",
    href: "/journal",
    action: "Ouvrir le journal",
  },
  {
    id: "pause",
    stage: 4,
    title: "Vérifiez le mode sûr",
    goal: "Repérez la mise en pause et le niveau d’autonomie appliqués côté serveur.",
    href: "/entreprise?onglet=agent",
    action: "Ouvrir les garde-fous",
  },
];

export const CONNECT_DATA_MISSION: WalkthroughMission = {
  id: "connect-data",
  stage: 5,
  title: "Connecter les sources utiles à votre activité",
  goal:
    "Distinguez les sources disponibles aujourd’hui des connexions prévues pour agir et mesurer.",
  href: "/entreprise?onglet=connecteurs",
  action: "Examiner les connecteurs",
};

const MISSION_IDS = new Set(WALKTHROUGH_MISSIONS.map((mission) => mission.id));

export function isWalkthroughPath(value: unknown): value is WalkthroughPath {
  return (
    typeof value === "string" &&
    (WALKTHROUGH_PATHS as readonly string[]).includes(value)
  );
}

export function isWalkthroughScenario(
  value: unknown,
): value is WalkthroughScenario {
  return (
    typeof value === "string" &&
    (WALKTHROUGH_SCENARIOS as readonly string[]).includes(value)
  );
}

export function emptyWalkthroughState(
  path: WalkthroughPath = "free",
  scenario?: WalkthroughScenario,
): WalkthroughState {
  return {
    version: WALKTHROUGH_VERSION,
    path,
    scenario,
    completed: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function parseWalkthroughState(raw: string | null): WalkthroughState {
  if (!raw) return emptyWalkthroughState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return emptyWalkthroughState();
    const candidate = value as Record<string, unknown>;
    if (
      candidate.version !== WALKTHROUGH_VERSION ||
      !isWalkthroughPath(candidate.path)
    ) {
      return emptyWalkthroughState();
    }
    const scenario = isWalkthroughScenario(candidate.scenario)
      ? candidate.scenario
      : undefined;
    const completed = Array.isArray(candidate.completed)
      ? [
          ...new Set(
            candidate.completed.filter(
              (id): id is string =>
                typeof id === "string" && MISSION_IDS.has(id),
            ),
          ),
        ]
      : [];
    return {
      version: WALKTHROUGH_VERSION,
      path: candidate.path,
      scenario,
      completed,
      updatedAt:
        typeof candidate.updatedAt === "string"
          ? candidate.updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return emptyWalkthroughState();
  }
}

export function walkthroughCompletedCount(state: WalkthroughState): number {
  return WALKTHROUGH_MISSIONS.filter((mission) =>
    state.completed.includes(mission.id),
  ).length;
}

/**
 * Nombre d'étapes terminées, indépendamment des onze missions internes.
 * Une étape est acquise lorsque toutes ses missions obligatoires le sont.
 */
export function walkthroughCompletedStageCount(
  state: WalkthroughState,
): number {
  return WALKTHROUGH_STAGES.filter((stage) =>
    WALKTHROUGH_MISSIONS.filter(
      (mission) => mission.stage === stage.id && !mission.optional,
    ).every((mission) => state.completed.includes(mission.id)),
  ).length;
}

/** Synchronise les deux missions de contexte depuis les champs de la mémoire. */
export function walkthroughCompletedWithContext(
  completed: readonly string[],
  context: { activity: boolean; voice: boolean },
): string[] {
  const next = completed.filter((id) => id !== "activity" && id !== "voice");
  if (context.activity) next.push("activity");
  if (context.voice) next.push("voice");
  return [...new Set(next)];
}

export function walkthroughIsComplete(state: WalkthroughState): boolean {
  return walkthroughCompletedCount(state) === WALKTHROUGH_MISSIONS.length;
}

export function walkthroughRequiredMissionsComplete(
  state: WalkthroughState,
): boolean {
  return WALKTHROUGH_MISSIONS.filter((mission) => !mission.optional).every(
    (mission) => state.completed.includes(mission.id),
  );
}
