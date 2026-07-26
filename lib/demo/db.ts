import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Petites fondations partagées par les écritures du mode démonstration.
 *
 * Elles vivent à part pour que `seed.ts` (données de démo) et
 * `memory-backup.ts` (fiche entreprise) puissent s'en servir tous les deux
 * sans se référencer l'un l'autre.
 */

/** Client service-role — serveur uniquement (cf. `lib/supabase/admin.ts`). */
export type Admin = ReturnType<typeof createAdminClient>;

/**
 * Fait échouer bruyamment une écriture Supabase ratée.
 *
 * Le mode démonstration touche à des données réelles (il les met de côté, puis
 * les rend) : une erreur avalée laisserait l'utilisateur devant un « retiré »
 * mensonger, avec des données fictives encore en base et sa fiche non
 * restaurée. Chaque `delete`/`upsert` passe donc par ici.
 */
export function ensureOk(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what} : ${error.message}`);
}
