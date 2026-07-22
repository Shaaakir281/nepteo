/**
 * Observabilité LLM — Langfuse pour l'AI SDK v7 (télémétrie par intégrations).
 *
 * v7 a changé de mécanisme : la télémétrie passe désormais par des intégrations
 * enregistrées via `registerTelemetry` (de `ai`) + un `LangfuseSpanProcessor`
 * OpenTelemetry qui envoie les spans à Langfuse. L'ancienne voie
 * (`@vercel/otel` + `LangfuseExporter` de `langfuse-vercel`) ne capte plus les
 * spans de l'AI SDK 7 → on utilise l'intégration officielle `@langfuse/vercel-ai-sdk`.
 *
 * Activation (les deux conditions) :
 *   1. paquets :  npm i @langfuse/otel @langfuse/vercel-ai-sdk @opentelemetry/sdk-node
 *   2. clés env : LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
 *      (et LANGFUSE_BASE_URL pour l'hébergement EU : https://cloud.langfuse.com)
 *
 * Sans clés ou sans paquets : no-op silencieux, aucune trace, build inchangé.
 * Les imports Langfuse/OTel sont dynamiques (spécificateur en variable) : le
 * bundler ne tente pas de les résoudre, le repo compile même sans ces paquets.
 * `@langfuse/*` requiert Node ≥ 22.
 */
import { registerTelemetry } from "ai";

let done = false;

export async function registerObservability(): Promise<void> {
  if (done) return;
  done = true;

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return; // pas de clés → traces désactivées
  }

  try {
    const sdkNodeName = "@opentelemetry/sdk-node";
    const langfuseOtelName = "@langfuse/otel";
    const langfuseAiName = "@langfuse/vercel-ai-sdk";

    const { NodeSDK } = (await import(sdkNodeName)) as {
      NodeSDK: new (opts: { spanProcessors: unknown[] }) => { start: () => void };
    };
    const { LangfuseSpanProcessor } = (await import(langfuseOtelName)) as {
      LangfuseSpanProcessor: new () => unknown;
    };
    const { LangfuseVercelAiSdkIntegration } = (await import(langfuseAiName)) as {
      LangfuseVercelAiSdkIntegration: new () => Parameters<typeof registerTelemetry>[0];
    };

    const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
    sdk.start();
    registerTelemetry(new LangfuseVercelAiSdkIntegration());
    console.info("[observability] Langfuse activé (AI SDK v7) — traces LLM par tâche.");
  } catch (e) {
    console.warn(
      "[observability] Langfuse non activé (paquets manquants ?) :",
      e instanceof Error ? e.message : e,
    );
  }
}
