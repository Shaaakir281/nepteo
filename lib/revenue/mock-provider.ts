import type { RevenueEvent } from "./revenue-rules";

/**
 * Ventes fictives (démo) — aucun import `@/`, déterministe. Sert à développer la
 * boucle revenu sans compte Stripe. L'API réelle produira les mêmes lignes.
 */

export interface MockSale extends RevenueEvent {
  external_id: string;
  source: string;
}

const PRODUCTS = [
  { label: "Accompagnement IA — forfait", price: 390 },
  { label: "Audit découverte", price: 90 },
  { label: "Pack 3 séances", price: 78 },
  { label: "Abonnement mensuel", price: 149 },
];

/** Pseudo-aléatoire déterministe dans [0,1). */
function rand(seed: number): number {
  const x = Math.sin(seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** ~14 ventes fictives réparties sur `days` jours (jusqu'à hier). */
export function mockRevenueEvents(days = 30, n = 14): MockSale[] {
  const out: MockSale[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < n; i++) {
    const p = PRODUCTS[Math.floor(rand(i * 3 + 1) * PRODUCTS.length)];
    const dayBack = 1 + Math.floor(rand(i * 5 + 2) * days);
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - dayBack);
    const jitter = 0.9 + rand(i * 7 + 3) * 0.2; // ±10 %
    out.push({
      source: "stripe",
      external_id: `demo_sale_${i}`,
      label: p.label,
      amount: Math.round(p.price * jitter * 100) / 100,
      occurred_on: d.toISOString().slice(0, 10),
    });
  }
  return out;
}
