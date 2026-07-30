/**
 * Normalise une date venant d'une source utilisateur vers `YYYY-MM-DD`.
 *
 * Formats acceptés :
 * - ISO : `2026-07-29` ou un horodatage commençant par cette date ;
 * - français : `29/07/2026`.
 *
 * Une valeur invalide ne doit jamais casser une synchronisation : elle devient
 * simplement `null` et sa forme originale reste disponible dans `raw`.
 */
export function normalizeContactDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;

  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const french = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (french) {
    return validIsoDate(
      Number(french[3]),
      Number(french[2]),
      Number(french[1]),
    );
  }

  return null;
}

function validIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}
