export interface NotionDatabaseOption {
  id: string;
  title: string;
}

export interface RemoteColumn {
  value: string;
  label: string;
}

export type RemoteListState<T> =
  | { status: "success"; items: T[] }
  | { status: "empty"; items: T[] }
  | { status: "error"; message: string };

export function remoteListState<T>(items: T[]): RemoteListState<T> {
  return items.length > 0
    ? { status: "success", items }
    : { status: "empty", items: [] };
}

export function remoteListError<T>(message: string): RemoteListState<T> {
  return { status: "error", message };
}

/**
 * Une seule valeur de formulaire porte l'identifiant et le titre Notion.
 * Contrairement à plusieurs champs cachés, seule l'option radio choisie est
 * envoyée : le titre ne peut donc pas provenir d'une autre ligne.
 */
export function encodeNotionDatabaseChoice(
  database: NotionDatabaseOption,
): string {
  return JSON.stringify([database.id, database.title]);
}

export function parseNotionDatabaseChoice(
  raw: FormDataEntryValue | null,
): NotionDatabaseOption | null {
  if (typeof raw !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string"
    ) {
      return null;
    }

    const id = parsed[0].trim();
    const title = parsed[1].trim();
    if (!id || !title || id.length > 200 || title.length > 500) return null;
    return { id, title };
  } catch {
    return null;
  }
}
