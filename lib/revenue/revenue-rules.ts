/**
 * Revenu — parties pures (aucun import `@/`, testable node:test).
 * Agrège le revenu réel (ventes) pour faire raisonner l'agent en euros gagnés.
 * Aucune métrique inventée : tout dérive des montants fournis.
 */

export interface RevenueEvent {
  amount: number; // €
  occurred_on: string; // YYYY-MM-DD
  label?: string | null;
}

export interface RevenueStats {
  total: number; // €
  count: number; // nombre de ventes
  avg: number; // panier moyen €
}

/** Totaux sur les événements fournis (déjà filtrés par période côté appelant). */
export function revenueStats(events: RevenueEvent[]): RevenueStats {
  const count = events.length;
  const total = events.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return {
    total: Math.round(total * 100) / 100,
    count,
    avg: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
  };
}

/** Retour sur dépense global : revenu / dépense publicitaire (0 si pas de dépense). */
export function overallRoas(revenueTotal: number, adSpend: number): number {
  return adSpend > 0 ? Math.round((revenueTotal / adSpend) * 100) / 100 : 0;
}
