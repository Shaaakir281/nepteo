import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemorySection } from "@/lib/memory";
import { isReservedSection } from "@/lib/demo/memory-backup-rules";

/**
 * Lecture de la mémoire entreprise — un seul endroit.
 *
 * Ce fichier vit à côté de `lib/memory.ts` mais n'en est PAS l'extension :
 * `memory.ts` est un fichier pur (zéro import, testé par `node:test`), il ne
 * peut donc pas parler à Supabase. Toute la logique de forme reste là-bas ;
 * seule l'I/O est ici.
 *
 * `sections` omis = toutes les sections (vues qui affichent la fiche).
 * Pour les prompts, passer `LLM_MEMORY_SECTIONS` (liste unique de `memory.ts`).
 * `orgId` n'est utile qu'avec le client service-role : avec le client serveur
 * classique, la RLS filtre déjà sur l'organisation de l'utilisateur.
 *
 * **Les sections réservées (préfixe `__`) ne sortent jamais d'ici.** Le mode
 * démonstration range la vraie fiche dans `__demo_backup` le temps d'un
 * scénario : sans ce filtre elle apparaîtrait dans `/entreprise` (qui boucle
 * sur les entrées) et voyagerait jusqu'aux prompts. Qui a besoin de la
 * sauvegarde la lit directement, dans `lib/demo/seed.ts`.
 */

/** Contexte mémoire tel que le consomment les moteurs (`memoText`, prompts…). */
export type MemoryCtx = Record<string, unknown>;

type MemoryRow = { section: string; content: unknown };

export async function readMemory(
  client: SupabaseClient,
  sections?: readonly MemorySection[],
  orgId?: string,
): Promise<MemoryCtx> {
  let query = client.from("company_memory").select("section, content");
  if (orgId) query = query.eq("organization_id", orgId);
  if (sections && sections.length > 0) query = query.in("section", [...sections]);

  const { data } = await query;
  return Object.fromEntries(
    ((data ?? []) as MemoryRow[])
      .filter((row) => !isReservedSection(row.section))
      .map((row) => [row.section, row.content]),
  );
}
