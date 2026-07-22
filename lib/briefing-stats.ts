/**
 * Briefing hebdomadaire — résumé de repli déterministe (aucun LLM).
 * Le calcul des stats vit dans lib/analysis-rules.ts (avec `prospectPriority`,
 * source unique). Ici, uniquement la mise en phrases de repli. `import type`
 * seulement → aucune résolution runtime, testable en node:test.
 */
import type { FunnelStats } from "./analysis-rules";

const plural = (n: number) => (n > 1 ? "s" : "");

/** Résumé de repli, déterministe (sans LLM). Toujours des phrases correctes. */
export function templateBriefing(stats: FunnelStats): string {
  if (stats.total === 0) {
    return "Aucun prospect synchronisé pour l'instant. Connectez une source de contacts pour que l'agent commence à analyser votre funnel.";
  }
  const parts: string[] = [];
  parts.push(`Votre base compte ${stats.total} prospect${plural(stats.total)}.`);
  if (stats.priority > 0) {
    parts.push(
      `${stats.priority} ${stats.priority > 1 ? "sont prêts" : "est prêt"} à être relancé${plural(stats.priority)} en priorité (joignable${plural(stats.priority)} et statut actif).`,
    );
  }
  if (stats.topStage) {
    parts.push(
      `Le plus gros groupe est au statut « ${stats.topStage.stage} » (${stats.topStage.count}).`,
    );
  }
  if (stats.noEmail > 0) {
    parts.push(
      `${stats.noEmail} fiche${plural(stats.noEmail)} ${stats.noEmail > 1 ? "restent" : "reste"} sans email et ${stats.noEmail > 1 ? "sont injoignables" : "est injoignable"}.`,
    );
  }
  return parts.join(" ");
}
