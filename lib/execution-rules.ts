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
  | "blocked_autonomy"
  | "already_executed"
  | "not_approved";

/**
 * Autorise (ou non) l'exécution d'une action. L'ordre compte : la pause prime
 * (bouton d'arrêt), puis le niveau d'autonomie ('suggest' = proposer seulement),
 * puis l'idempotence (déjà exécutée), puis l'état validé.
 */
export function guardExecution(input: {
  status: string;
  paused: boolean;
  autonomy?: string;
}): { ok: true } | { ok: false; reason: GuardReason } {
  if (input.paused) return { ok: false, reason: "blocked_paused" };
  if (input.autonomy === "suggest") return { ok: false, reason: "blocked_autonomy" };
  if (input.status === "executed") return { ok: false, reason: "already_executed" };
  if (input.status !== "approved") return { ok: false, reason: "not_approved" };
  return { ok: true };
}

export type ExecutionClaimFailureReason =
  | "not_found"
  | "already_executed"
  | "not_approved"
  | "claim_held_recovery_required"
  | "claim_conflict_retry_required";

/**
 * Explique l'échec d'un claim atomique après relecture de l'action.
 *
 * Un claim non nul peut appartenir à une exécution encore active comme à une
 * exécution interrompue. Sans bail horodaté, une reprise automatique ne peut
 * pas être prouvée sûre : on échoue donc fermé et on exige une vérification
 * explicite du journal/de l'outbox avant toute remise à zéro.
 */
export function classifyExecutionClaimFailure(input: {
  exists: boolean;
  status?: string | null;
  idempotencyKey?: string | null;
}): ExecutionClaimFailureReason {
  if (!input.exists) return "not_found";
  if (input.status === "executed") return "already_executed";
  if (input.status !== "approved") return "not_approved";
  if (input.idempotencyKey) return "claim_held_recovery_required";
  return "claim_conflict_retry_required";
}

export type ExecutionClaimResult =
  | {
      claimed: true;
      action: { kind: string; payload: unknown };
    }
  | {
      claimed: false;
      reason: string;
    };

/** Valide strictement le JSON renvoyé par la RPC de claim transactionnelle. */
export function readExecutionClaim(raw: unknown): ExecutionClaimResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;

  if (value.claimed === false) {
    return typeof value.reason === "string" && value.reason.length > 0
      ? { claimed: false, reason: value.reason }
      : null;
  }
  if (value.claimed !== true) return null;
  if (
    !value.action ||
    typeof value.action !== "object" ||
    Array.isArray(value.action)
  ) {
    return null;
  }

  const action = value.action as Record<string, unknown>;
  if (typeof action.kind !== "string" || action.kind.length === 0) return null;
  return {
    claimed: true,
    action: { kind: action.kind, payload: action.payload },
  };
}

export interface Recipient {
  id: string;
  email: string | null;
  name: string | null;
}

export function normalizedEmailKey(
  email: string | null | undefined,
): string | null {
  const key = (email ?? "").trim().toLowerCase();
  return key || null;
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
    const key = normalizedEmailKey(r.email);
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
