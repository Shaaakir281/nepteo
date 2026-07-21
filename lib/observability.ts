/**
 * Observabilité LLM — Langfuse via OpenTelemetry.
 *
 * Les appels LLM émettent déjà des spans OTel nommés par tâche
 * (voir `telemetryForTask` dans lib/llm.ts). Ce module branche l'exportateur
 * Langfuse qui les ingère.
 *
 * Activation (les deux conditions) :
 *   1. installer les paquets :  npm i @vercel/otel langfuse-vercel
 *   2. renseigner les clés env : LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
 *      (et LANGFUSE_BASEURL pour l'hébergement EU : https://cloud.langfuse.com)
 *
 * Sans clés ou sans paquets : no-op silencieux, aucune trace, build inchangé.
 * Les imports sont dynamiques à specifier variable : le bundler ne tente pas de
 * les résoudre, le repo compile même sans ces paquets.
 *
 * ⚠️ AI SDK v7 : l'API télémétrie a changé (regroupement par `functionId`, plus
 * de `metadata`). À l'activation, vérifier que les spans arrivent bien dans
 * Langfuse ; si besoin, utiliser l'intégration Langfuse à jour pour `ai@7`.
 */
let done = false;

export async function registerObservability(): Promise<void> {
  if (done) return;
  done = true;

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return; // pas de clés → traces désactivées
  }

  try {
    const otelName = "@vercel/otel";
    const langfuseName = "langfuse-vercel";
    const otel = (await import(otelName)) as {
      registerOTel: (opts: {
        serviceName: string;
        traceExporter: unknown;
      }) => void;
    };
    const langfuse = (await import(langfuseName)) as {
      LangfuseExporter: new () => unknown;
    };
    otel.registerOTel({
      serviceName: "nepteo",
      traceExporter: new langfuse.LangfuseExporter(),
    });
    console.info("[observability] Langfuse activé — traces LLM par tâche.");
  } catch (e) {
    console.warn(
      "[observability] Langfuse non activé (paquets manquants ?) :",
      e instanceof Error ? e.message : e,
    );
  }
}
