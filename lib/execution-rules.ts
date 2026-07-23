/**
 * Règles d'exécution Phase 3 — parties pures (aucun import `@/`, testable).
 * Garde-fous décidés côté serveur : ne s'exécute que sur une action validée,
 * jamais en pause, jamais deux fois ; plafonds par exécution et par jour.
 * L'orchestration (idempotence, insert outbox, journal) vit dans lib/execution.ts.
 */

/** Plafonds serveur (jamais uniquement en UI). */
export const MAX_PER_RUN = 50;
export const MAX_PER_DAY = 200;

export type GuardReason =
  | "blocked_paused"
  | "already_executed"
  | "not_approved";

/**
 * Autorise (ou non) l'exécution d'une action. L'ordre compte : la pause prime
 * (bouton d'arrêt), puis l'idempotence (déjà exécutée), puis l'état validé.
 */
export function guardExecution(input: {
  status: string;
  paused: boolean;
}): { ok: true } | { ok: false; reason: GuardReason } {
  if (input.paused) return { ok: false, reason: "blocked_paused" };
  if (input.status === "executed") return { ok: false, reason: "already_executed" };
  if (input.status !== "approved") return { ok: false, reason: "not_approved" };
  return { ok: true };
}

export interface Recipient {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Déduplique par email normalisé (casse/espaces) en gardant la 1re occurrence.
 * Évite d'adresser deux fois la même personne quand plusieurs connecteurs lisent
 * la même base (lignes en double dans `prospects`). Les lignes sans email sont
 * conservées (elles seront filtrées ensuite par `planRecipients`).
 */
export function dedupeByEmail<T extends { email: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = (r.email ?? "").trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(r);
  }
  return out;
}

const normText = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Déduplique une liste de contacts : email si présent (clé fiable), **sinon**
 * secours nom + entreprise (fiches sans email). Ni email ni nom → conservé.
 * Le secours nom+entreprise est un compromis d'affichage (risque de fusionner
 * deux homonymes de la même société), utile pour la liste par prospect.
 */
export function dedupeContacts<
  T extends { email: string | null; name?: string | null; company?: string | null },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const email = normText(r.email);
    const name = normText(r.name);
    const key = email
      ? `e:${email}`
      : name
        ? `nc:${name}|${normText(r.company)}`
        : "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Sélectionne les destinataires réellement adressables et applique les plafonds.
 * Filtre les fiches sans email, borne au reste du budget quotidien et au plafond
 * par exécution. `capped` = vrai si des destinataires ont été écartés par un plafond.
 */
export function planRecipients<T extends Recipient>(
  prospects: T[],
  opts: { sentToday: number },
): { recipients: T[]; skippedNoEmail: number; capped: boolean } {
  const withEmail = prospects.filter((p) => (p.email ?? "").trim() !== "");
  const skippedNoEmail = prospects.length - withEmail.length;
  const remainingToday = Math.max(0, MAX_PER_DAY - Math.max(0, opts.sentToday));
  const limit = Math.min(withEmail.length, MAX_PER_RUN, remainingToday);
  return {
    recipients: withEmail.slice(0, limit),
    skippedNoEmail,
    capped: withEmail.length > limit,
  };
}
