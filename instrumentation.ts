/**
 * Point d'instrumentation Next.js (App Router).
 * Exécuté une fois au démarrage du runtime serveur : branche l'observabilité
 * LLM (Langfuse via OTel) si les clés et paquets sont présents, sinon no-op.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerObservability } = await import("@/lib/observability");
  await registerObservability();
}
