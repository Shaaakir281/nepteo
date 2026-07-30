import { normalizedEmailKey } from "./execution-rules.ts";

export interface SnapshotProspectIdentity {
  id: string;
  email: string | null;
}

/**
 * Restreint une cohorte déjà canonicalisée aux membres d'un snapshot.
 *
 * L'ID du représentant canonique peut changer quand deux connecteurs
 * synchronisent le même contact dans un ordre différent. On retrouve alors le
 * membre figé grâce à l'email courant de sa ligne source et on conserve son ID
 * de snapshot pour les brouillons, l'outbox et l'idempotence.
 *
 * Une ligne disparue ou sans identité commune n'est jamais devinée : elle est
 * exclue, ce qui maintient un comportement fail-closed.
 */
export function restrictCanonicalCohortToSnapshot<
  T extends SnapshotProspectIdentity,
>(
  canonicalRows: readonly T[],
  rawRows: readonly SnapshotProspectIdentity[],
  snapshotIds: ReadonlySet<string>,
): T[] {
  const snapshotIdByEmail = new Map<string, string>();

  for (const row of rawRows) {
    if (!snapshotIds.has(row.id)) continue;
    const email = normalizedEmailKey(row.email);
    if (!email) continue;

    const currentId = snapshotIdByEmail.get(email);
    if (!currentId || row.id < currentId) {
      snapshotIdByEmail.set(email, row.id);
    }
  }

  const restricted: T[] = [];
  for (const row of canonicalRows) {
    const email = normalizedEmailKey(row.email);
    const snapshotId = snapshotIds.has(row.id)
      ? row.id
      : email
        ? snapshotIdByEmail.get(email)
        : undefined;
    if (!snapshotId) continue;
    restricted.push(
      snapshotId === row.id ? row : { ...row, id: snapshotId },
    );
  }

  return restricted;
}
