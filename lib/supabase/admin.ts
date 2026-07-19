import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client service-role — SERVEUR UNIQUEMENT (server actions, route handlers, jobs).
 * Contourne la RLS : toute écriture passe par ici, avec les garde-fous
 * applicatifs, et s'accompagne d'une écriture au journal.
 * Ne JAMAIS importer depuis un composant client.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient ne doit jamais être appelé côté client");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
