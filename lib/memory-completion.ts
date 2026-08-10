/** Calculs purs de complétude de la mémoire entreprise. */

export const WALKTHROUGH_CONTEXT_SECTIONS = [
  "activite",
  "zone",
  "ton",
  "philosophie",
] as const;

export interface WalkthroughContextCompletion {
  activity: boolean;
  voice: boolean;
  complete: boolean;
}

function nonEmptyText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function sectionObject(
  memory: Record<string, unknown>,
  section: string,
): Record<string, unknown> | null {
  const value = memory[section];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function memorySectionIsFilled(
  memory: Record<string, unknown>,
  section: (typeof WALKTHROUGH_CONTEXT_SECTIONS)[number],
): boolean {
  const content = sectionObject(memory, section);
  if (!content) return false;
  if (section === "activite") {
    return ["activity_type", "audience", "description"].some((field) =>
      nonEmptyText(content[field]),
    );
  }
  return nonEmptyText(content.text);
}

/**
 * Les deux missions de contexte couvrent quatre champs nommés : activité +
 * zone, puis ton + philosophie. Une simple visite de la fiche ne compte pas.
 */
export function walkthroughContextCompletion(
  memory: Record<string, unknown>,
): WalkthroughContextCompletion {
  const activity =
    memorySectionIsFilled(memory, "activite") &&
    memorySectionIsFilled(memory, "zone");
  const voice =
    memorySectionIsFilled(memory, "ton") &&
    memorySectionIsFilled(memory, "philosophie");
  return { activity, voice, complete: activity && voice };
}
