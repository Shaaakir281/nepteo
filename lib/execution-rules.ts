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
