/**
 * Règles d'analyse Phase 2 — détectent, ne proposent que.
 * Chaque règle est calculée sur les champs réellement synchronisés
 * (email, stage, source, company, name). Aucune métrique inventée.
 * L'orchestration (dédupe, habillage LLM, insert, journal) vit dans analysis.ts.
 */

export interface RuleProspect {
  email: string | null;
  stage: string | null;
  source: string | null;
  company: string | null;
  name: string | null;
}

export interface Finding {
  kind: string;
  title: string;
  finding: string; // constat
  rationale: string; // raison (peut être réécrite par le LLM)
  data_sources: string[];
  expected_impact: string;
  confidence: number;
  risk: "low" | "medium" | "high";
  payload: Record<string, unknown>;
}

const plural = (n: number) => (n > 1 ? "s" : "");

/* ---------- Signal de priorité (Phase 2) ----------
 * Transparent et explicable : dérivé UNIQUEMENT de faits réels — le statut et la
 * complétude de la fiche (email, entreprise). Aucun score inventé, aucune donnée
 * d'activité ou d'engagement (indisponible). Défini ici pour être partagé tel quel
 * avec le kanban : une seule définition de « à relancer en priorité ».
 */
export type PriorityTier = "priority" | "incomplete" | "paused";

export interface ProspectPriority {
  tier: PriorityTier;
  label: string;
  reason: string;
}

/** Statuts terminaux (gagné / client / perdu / désabonné…), normalisés sans accents. */
const TERMINAL_TOKENS = [
  "client", "gagne", "signe", "conclu", "won", "perdu", "lost",
  "desabonne", "unsubscribed", "refus", "clos", "closed", "annul", "inactif",
];

const normStage = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Un statut renseigné et non terminal = « actif » (encore dans le parcours de vente). */
export function isTerminalStage(stage: string | null): boolean {
  const s = normStage(stage ?? "");
  return s !== "" && TERMINAL_TOKENS.some((t) => s.includes(t));
}

/**
 * Priorité d'un prospect, à partir de deux faits visibles :
 *  - joignable : une adresse email est présente (sinon aucune relance possible) ;
 *  - statut actif : renseigné et non terminal.
 * « À relancer en priorité » = joignable ET actif. Sinon la fiche est à compléter
 * (email ou statut manquant) ou en veille (dossier clos).
 */
export function prospectPriority(p: {
  email: string | null;
  stage: string | null;
  company: string | null;
}): ProspectPriority {
  const reachable = (p.email ?? "").trim() !== "";
  const stage = (p.stage ?? "").trim();

  if (!reachable)
    return {
      tier: "incomplete",
      label: "Fiche à compléter",
      reason: "Email manquant — injoignable pour une relance.",
    };
  if (stage === "")
    return {
      tier: "incomplete",
      label: "Fiche à compléter",
      reason: "Sans statut — à classer avant de relancer.",
    };
  if (isTerminalStage(stage))
    return {
      tier: "paused",
      label: "En veille",
      reason: `Statut « ${stage} » — dossier clos, pas de relance.`,
    };

  const complete = (p.company ?? "").trim() !== "";
  return {
    tier: "priority",
    label: "À relancer en priorité",
    reason: complete
      ? `Joignable, statut actif « ${stage} », fiche complète.`
      : `Joignable, statut actif « ${stage} » (entreprise à compléter).`,
  };
}

/* ---------- Statistiques de funnel (briefing, Phase 2) ----------
 * Agrégats purs sur les prospects réels — partagés avec le briefing. Réutilise
 * `prospectPriority` (source unique de « prêt à relancer »). Aucune invention.
 */
export interface BriefingProspect {
  email: string | null;
  stage: string | null;
  company: string | null;
}

export interface FunnelStats {
  total: number;
  priority: number; // joignables + statut actif (prêts à relancer)
  noEmail: number;
  noStage: number;
  topStage: { stage: string; count: number } | null;
}

export function computeFunnelStats(prospects: BriefingProspect[]): FunnelStats {
  const total = prospects.length;
  let priority = 0;
  let noEmail = 0;
  let noStage = 0;
  const byStage = new Map<string, number>();

  for (const p of prospects) {
    if (prospectPriority(p).tier === "priority") priority++;
    if (!(p.email ?? "").trim()) noEmail++;
    const s = (p.stage ?? "").trim();
    if (!s) noStage++;
    else byStage.set(s, (byStage.get(s) ?? 0) + 1);
  }

  const top = [...byStage.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    total,
    priority,
    noEmail,
    noStage,
    topStage: top ? { stage: top[0], count: top[1] } : null,
  };
}

/** Toutes les propositions déclenchées par l'état actuel de la base. */
export function buildFindings(all: RuleProspect[]): Finding[] {
  const findings: Finding[] = [];
  const total = all.length;
  if (total === 0) return findings;

  const sourceList = [...new Set(all.map((p) => p.source).filter(Boolean))].join(", ");
  const src = [`prospects (${sourceList})`];

  // Règle 1 — emails manquants (qualité de données)
  const noEmail = all.filter((p) => !p.email).length;
  if (noEmail > 0) {
    findings.push({
      kind: "complete_missing_emails",
      title: `Compléter ${noEmail} email${plural(noEmail)} manquant${plural(noEmail)}`,
      finding: `${noEmail} prospect${plural(noEmail)} sur ${total} n'${noEmail > 1 ? "ont" : "a"} pas d'adresse email.`,
      rationale:
        "Sans email, aucune relance n'est possible — c'est la première fuite du funnel à colmater.",
      data_sources: src,
      expected_impact: `${noEmail} prospect${plural(noEmail)} de plus joignable${plural(noEmail)} pour les relances`,
      confidence: 0.9,
      risk: "low",
      payload: { count: noEmail, total },
    });
  }

  // Règle 2 — plus gros groupe par statut → relance ciblée
  const byStage = new Map<string, number>();
  for (const p of all) {
    const s = (p.stage ?? "").trim();
    if (s) byStage.set(s, (byStage.get(s) ?? 0) + 1);
  }
  const top = [...byStage.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    const [stage, count] = top;
    findings.push({
      kind: `relaunch_stage_${stage.toLowerCase().replace(/\W+/g, "_")}`,
      title: `Préparer la relance des ${count} prospects « ${stage} »`,
      finding: `${count} prospects sur ${total} sont au statut « ${stage} » — le groupe le plus important de votre base.`,
      rationale:
        "Concentrer l'effort sur le groupe le plus fourni maximise le retour d'une seule action de relance.",
      data_sources: src,
      expected_impact: `${count} prospects recontactés en une action`,
      confidence: 0.7,
      risk: "low",
      payload: { stage, count },
    });
  }

  // Règle 2 bis — relancer en priorité : joignables ET statut actif. Même signal
  // que le kanban (prospectPriority). Distincte de la règle 2 : pas le plus gros
  // groupe, mais les contacts les plus prêts à recontacter, tous statuts confondus.
  const ready = all.filter((p) => prospectPriority(p).tier === "priority").length;
  if (ready >= 2) {
    findings.push({
      kind: "relaunch_priority",
      title: `Relancer en priorité ${ready} prospect${plural(ready)} prêt${plural(ready)}`,
      finding: `${ready} prospect${plural(ready)} sur ${total} ${ready > 1 ? "sont joignables" : "est joignable"} et à un statut encore actif — ${ready > 1 ? "les plus prêts" : "le plus prêt"} à être recontacté${plural(ready)}.`,
      rationale:
        "Ces contacts réunissent les deux conditions d'une relance utile : une adresse valide et un statut encore ouvert. Les traiter d'abord concentre l'effort là où il peut aboutir, sans attendre de compléter le reste de la base.",
      data_sources: src,
      expected_impact: `${ready} relance${plural(ready)} adressée${plural(ready)} d'abord aux contacts les plus actionnables`,
      confidence: 0.75,
      risk: "low",
      payload: { count: ready, total },
    });
  }

  // Règle 3 — prospects sans statut → à classer (invisibles dans le funnel)
  const noStage = all.filter((p) => !(p.stage ?? "").trim()).length;
  if (noStage > 0 && noStage < total) {
    findings.push({
      kind: "classify_unlabeled",
      title: `Classer ${noStage} prospect${plural(noStage)} sans statut`,
      finding: `${noStage} prospect${plural(noStage)} sur ${total} n'${noStage > 1 ? "ont" : "a"} aucun statut — ${noStage > 1 ? "ils sont invisibles" : "il est invisible"} dans votre funnel.`,
      rationale:
        "Un prospect sans statut n'est jamais relancé : le classer le remet dans le parcours de vente.",
      data_sources: src,
      expected_impact: `${noStage} prospect${plural(noStage)} replacé${plural(noStage)} dans le funnel`,
      confidence: 0.8,
      risk: "low",
      payload: { count: noStage, total },
    });
  }

  // Règle 4 — doublons d'email (hygiène de base)
  const emailCounts = new Map<string, number>();
  for (const p of all) {
    const e = (p.email ?? "").trim().toLowerCase();
    if (e) emailCounts.set(e, (emailCounts.get(e) ?? 0) + 1);
  }
  const dupValues = [...emailCounts.values()].filter((n) => n > 1);
  const dupExtra = dupValues.reduce((s, n) => s + (n - 1), 0);
  if (dupExtra > 0) {
    findings.push({
      kind: "dedupe_emails",
      title: `Fusionner ${dupExtra} doublon${plural(dupExtra)} d'email`,
      finding: `${dupValues.length} adresse${plural(dupValues.length)} email apparaî${dupValues.length > 1 ? "ssent" : "t"} en plusieurs exemplaires (${dupExtra} doublon${plural(dupExtra)}).`,
      rationale:
        "Les doublons faussent vos comptages et risquent de relancer deux fois la même personne — mieux vaut les fusionner.",
      data_sources: src,
      expected_impact: `Base assainie, ${dupExtra} relance${plural(dupExtra)} en double évitée${plural(dupExtra)}`,
      confidence: 0.85,
      risk: "low",
      payload: { duplicate_values: dupValues.length, extra: dupExtra },
    });
  }

  // Règle 5 — entreprise manquante en volume (segmentation)
  const noCompany = all.filter((p) => !(p.company ?? "").trim()).length;
  if (total >= 5 && noCompany / total >= 0.4) {
    findings.push({
      kind: "complete_missing_company",
      title: `Renseigner l'entreprise de ${noCompany} prospect${plural(noCompany)}`,
      finding: `${noCompany} prospect${plural(noCompany)} sur ${total} n'${noCompany > 1 ? "ont" : "a"} pas d'entreprise renseignée.`,
      rationale:
        "L'entreprise permet de segmenter et de personnaliser les messages : sans elle, vos relances restent génériques.",
      data_sources: src,
      expected_impact: "Segmentation possible, messages plus ciblés",
      confidence: 0.6,
      risk: "low",
      payload: { count: noCompany, total },
    });
  }

  return findings;
}
