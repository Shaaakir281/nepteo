export const AMBIGUOUS_MEMBERSHIP_ERROR =
  "Invariant d'organisation violé : plusieurs organisations sont rattachées au même utilisateur.";

/**
 * Résout le membership courant sans jamais choisir arbitrairement entre
 * plusieurs organisations.
 */
export function resolveSingleMembership<T>(
  memberships: readonly T[],
): T | null {
  if (memberships.length > 1) {
    throw new Error(AMBIGUOUS_MEMBERSHIP_ERROR);
  }

  return memberships[0] ?? null;
}
