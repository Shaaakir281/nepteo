/** Calculs purs de complétude de la mémoire entreprise. */

export const WALKTHROUGH_CONTEXT_SECTIONS = [
  "activite",
  "zone",
  "ton",
  "philosophie",
] as const;

export const PROFILE_MEMORY_FIELDS = [
  "activite",
  "zone",
  "offres",
  "ton",
  "philosophie",
  "canaux",
  "communication",
  "objectifs",
] as const;

export type ProfileMemoryField = (typeof PROFILE_MEMORY_FIELDS)[number];
type MemoryCompletionSection =
  | Exclude<ProfileMemoryField, "communication">
  | "presence";

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
  section: MemoryCompletionSection,
): boolean {
  const content = sectionObject(memory, section);
  if (!content) return false;
  if (section === "activite") {
    return ["activity_type", "audience", "description"].some((field) =>
      nonEmptyText(content[field]),
    );
  }
  if (section === "zone" || section === "ton" || section === "philosophie") {
    return nonEmptyText(content.text);
  }
  if (section === "offres") {
    return (
      Array.isArray(content.items) &&
      content.items.some(
        (item) =>
          item &&
          typeof item === "object" &&
          nonEmptyText((item as Record<string, unknown>).name),
      )
    );
  }
  return (
    Array.isArray(content.list) && content.list.some((item) => nonEmptyText(item))
  );
}

export function profileMemoryCompletion(memory: Record<string, unknown>): {
  completed: number;
  total: number;
  filled: ProfileMemoryField[];
} {
  const filled = PROFILE_MEMORY_FIELDS.filter((field) =>
    memorySectionIsFilled(
      memory,
      field === "communication" ? "presence" : field,
    ),
  );
  return { completed: filled.length, total: PROFILE_MEMORY_FIELDS.length, filled };
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
