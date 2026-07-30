export interface DemoAnalysisStep {
  ok: boolean;
  created: number;
  detail?: string;
}

export function demoAnalysisDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.trim().slice(0, 300) || "erreur inconnue";
}

/** Transforme toute issue moteur en résultat explicite, sans perdre un compte
 * déjà créé si l'étape suivante (par exemple son journal) échoue. */
export async function settleDemoAnalysis(
  run: () => Promise<number>,
): Promise<DemoAnalysisStep> {
  try {
    return { ok: true, created: await run() };
  } catch (error) {
    return { ok: false, created: 0, detail: demoAnalysisDetail(error) };
  }
}
