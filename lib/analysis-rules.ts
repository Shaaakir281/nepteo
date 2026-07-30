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
  last_contact_at?: string | null;
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
  daysSinceContact?: number;
}

export const RECENT_CONTACT_DAYS = 7;
export const STALE_CONTACT_DAYS = 21;
export const DORMANT_COHORT_LIMIT = 50;
export const DORMANT_SILENCE_THRESHOLDS = [30, 45] as const;
export type DormantSilenceDays =
  (typeof DORMANT_SILENCE_THRESHOLDS)[number];
const DAY_MS = 86_400_000;

/** Statuts terminaux (gagné / client / perdu / désabonné…), normalisés sans accents. */
const TERMINAL_TOKENS = [
  "client", "gagne", "signe", "conclu", "won", "perdu", "lost",
  "desabonne", "unsubscribed", "refus", "clos", "closed", "annul", "inactif",
  "opposition", "oppose", "ne pas contacter", "do not contact", "dnc",
  "opt-out", "opt out", "optout",
];

const normStage = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Âge d'un dernier contact, en jours UTC. Dates invalides → information absente. */
export function daysSinceContact(
  lastContactAt: string | null | undefined,
  today: string | undefined,
): number | null {
  if (!lastContactAt || !today) return null;
  const last = isoDateMs(lastContactAt);
  const now = isoDateMs(today);
  if (last === null || now === null) return null;
  // Une date future est incohérente pour un « dernier contact ». On la traite
  // prudemment comme un contact du jour afin de ne pas déclencher de relance.
  return Math.max(0, Math.floor((now - last) / DAY_MS));
}

export function isoDateMs(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

function isDormantSilenceDays(value: unknown): value is DormantSilenceDays {
  return value === 30 || value === 45;
}

interface DormantProspect {
  email: string | null;
  stage: string | null;
  last_contact_at?: string | null;
}

function isDormantProspect(
  prospect: DormantProspect,
  today: string | undefined,
  minSilenceDays: unknown,
): boolean {
  if (!isDormantSilenceDays(minSilenceDays)) return false;
  if (!(prospect.email ?? "").trim()) return false;

  const stage = (prospect.stage ?? "").trim();
  if (!stage || isTerminalStage(stage)) return false;

  const silenceDays = daysSinceContact(prospect.last_contact_at, today);
  return silenceDays !== null && silenceDays >= minSilenceDays;
}

/**
 * Sélectionne une cohorte dormante sans inventer de date ni de score.
 *
 * Le choix du seuil reste explicite (30 ou 45 jours). Les dates absentes,
 * invalides ou futures ne peuvent donc jamais déclencher une relance. Le tri
 * place les silences les plus anciens en premier et conserve l'ordre d'entrée
 * en cas d'égalité, sans modifier le tableau fourni.
 */
export function selectDormantProspects<T extends DormantProspect>(
  prospects: readonly T[],
  today: string | undefined,
  minSilenceDays: number,
): T[] {
  if (!isDormantSilenceDays(minSilenceDays) || isoDateMs(today ?? "") === null) {
    return [];
  }

  return prospects
    .map((prospect, inputIndex) => ({
      prospect,
      inputIndex,
      lastContactMs: isoDateMs(prospect.last_contact_at ?? ""),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        prospect: T;
        inputIndex: number;
        lastContactMs: number;
      } =>
        candidate.lastContactMs !== null &&
        isDormantProspect(candidate.prospect, today, minSilenceDays),
    )
    .sort(
      (a, b) =>
        a.lastContactMs - b.lastContactMs ||
        a.inputIndex - b.inputIndex,
    )
    .slice(0, DORMANT_COHORT_LIMIT)
    .map(({ prospect }) => prospect);
}

export function wasContactedRecently(
  p: { last_contact_at?: string | null },
  today: string | undefined,
): boolean {
  const days = daysSinceContact(p.last_contact_at, today);
  return days !== null && days < RECENT_CONTACT_DAYS;
}

function contactAgeText(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "il y a 1 jour";
  return `il y a ${days} jours`;
}

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
  last_contact_at?: string | null;
}, today?: string): ProspectPriority {
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

  const contactAge = daysSinceContact(p.last_contact_at, today);
  if (contactAge !== null && contactAge < RECENT_CONTACT_DAYS) {
    return {
      tier: "paused",
      label: "Contact récent",
      reason: `Dernier contact ${contactAgeText(contactAge)} — aucune relance avant ${RECENT_CONTACT_DAYS} jours.`,
      daysSinceContact: contactAge,
    };
  }

  const complete = (p.company ?? "").trim() !== "";
  if (contactAge !== null && contactAge >= STALE_CONTACT_DAYS) {
    return {
      tier: "priority",
      label: `Sans nouvelle depuis ${contactAge} jours`,
      reason: `Joignable, statut actif « ${stage} », dernier contact ${contactAgeText(contactAge)}.`,
      daysSinceContact: contactAge,
    };
  }
  return {
    tier: "priority",
    label: "À relancer en priorité",
    reason:
      contactAge !== null
        ? `Joignable, statut actif « ${stage} », dernier contact ${contactAgeText(contactAge)}.`
        : complete
          ? `Joignable, statut actif « ${stage} », fiche complète.`
          : `Joignable, statut actif « ${stage} » (entreprise à compléter).`,
    ...(contactAge !== null ? { daysSinceContact: contactAge } : {}),
  };
}

/**
 * Indique si un prospect appartient à la cible d'une action de relance.
 * Cette règle pure est destinée à rester identique entre l'aperçu présenté à
 * l'utilisateur et la préparation effective des messages.
 */
export function matchesRelaunchTarget(
  kind: string,
  payload: Record<string, unknown>,
  prospect: {
    email: string | null;
    stage: string | null;
    company: string | null;
    last_contact_at?: string | null;
  },
  today?: string,
): boolean {
  if (kind === "relaunch_dormant") {
    return isDormantProspect(
      prospect,
      today,
      payload.min_silence_days,
    );
  }
  if (kind === "relaunch_priority") {
    return prospectPriority(prospect, today).tier === "priority";
  }
  if (kind.startsWith("relaunch_stage_")) {
    // Une ancienne action par statut peut survivre à une évolution de la fiche.
    // On revalide donc les mêmes garanties que pour `relaunch_priority` au
    // moment de préparer la cible : joignable, statut actif et contact non récent.
    if (prospectPriority(prospect, today).tier !== "priority") return false;
    const stage = ((payload.stage as string | undefined) ?? "").trim();
    return (prospect.stage ?? "").trim() === stage;
  }
  return false;
}

/* ---------- Statistiques de funnel (briefing, Phase 2) ----------
 * Agrégats purs sur les prospects réels — partagés avec le briefing. Réutilise
 * `prospectPriority` (source unique de « prêt à relancer »). Aucune invention.
 */
export interface BriefingProspect {
  email: string | null;
  stage: string | null;
  company: string | null;
  last_contact_at?: string | null;
}

export interface FunnelStats {
  total: number;
  priority: number; // joignables + statut actif (prêts à relancer)
  noEmail: number;
  noStage: number;
  topStage: { stage: string; count: number } | null;
}

export function computeFunnelStats(
  prospects: BriefingProspect[],
  today?: string,
): FunnelStats {
  const total = prospects.length;
  let priority = 0;
  let noEmail = 0;
  let noStage = 0;
  const byStage = new Map<string, number>();

  for (const p of prospects) {
    if (prospectPriority(p, today).tier === "priority") priority++;
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

/**
 * Toutes les propositions déclenchées par l'état actuel de la base.
 *
 * La cohorte canonique porte tous les chiffres métier. Les lignes brutes,
 * lorsqu'elles sont fournies, ne servent qu'à signaler les doublons d'email et
 * à restituer la liste complète des sources. La surcharge historique
 * `buildFindings(prospects, today)` reste acceptée.
 */
export function buildFindings(
  canonical: RuleProspect[],
  today?: string,
): Finding[];
export function buildFindings(
  canonical: RuleProspect[],
  rawRows: RuleProspect[],
  today?: string,
): Finding[];
export function buildFindings(
  canonical: RuleProspect[],
  rawRowsOrToday?: RuleProspect[] | string,
  today?: string,
): Finding[] {
  const rawRows = Array.isArray(rawRowsOrToday) ? rawRowsOrToday : canonical;
  const effectiveToday =
    typeof rawRowsOrToday === "string" ? rawRowsOrToday : today;
  const findings: Finding[] = [];
  const total = canonical.length;
  if (total === 0) return findings;

  const sourceList = [
    ...new Set(rawRows.map((p) => p.source).filter(Boolean)),
  ].join(", ");
  const src = [`prospects (${sourceList})`];

  // Règle 1 — emails manquants (qualité de données)
  const noEmail = canonical.filter((p) => !(p.email ?? "").trim()).length;
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
  for (const p of canonical) {
    const s = (p.stage ?? "").trim();
    // Une relance proposée doit compter uniquement des prospects réellement
    // joignables et encore actifs. Le volume brut reste traité par les règles
    // de qualité de données, pas transformé en fausse opportunité commerciale.
    if (
      !(p.email ?? "").trim() ||
      !s ||
      isTerminalStage(s) ||
      wasContactedRecently(p, effectiveToday)
    ) {
      continue;
    }
    byStage.set(s, (byStage.get(s) ?? 0) + 1);
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
  const readyProspects = canonical.filter(
    (p) => prospectPriority(p, effectiveToday).tier === "priority",
  );
  const ready = readyProspects.length;
  if (ready >= 2) {
    const staleAges = readyProspects
      .map((p) => daysSinceContact(p.last_contact_at, effectiveToday))
      .filter((days): days is number => days !== null && days >= STALE_CONTACT_DAYS);
    const oldestContactDays =
      staleAges.length > 0 ? Math.max(...staleAges) : null;
    const staleDetail =
      staleAges.length > 0
        ? ` ${staleAges.length} ${staleAges.length > 1 ? "sont sans nouvelle" : "est sans nouvelle"} depuis au moins ${STALE_CONTACT_DAYS} jours${oldestContactDays ? ` (jusqu'à ${oldestContactDays} jours)` : ""}.`
        : "";
    findings.push({
      kind: "relaunch_priority",
      title: `Relancer en priorité ${ready} prospect${plural(ready)} prêt${plural(ready)}`,
      finding: `${ready} prospect${plural(ready)} sur ${total} ${ready > 1 ? "sont joignables" : "est joignable"} et à un statut encore actif — ${ready > 1 ? "les plus prêts" : "le plus prêt"} à être recontacté${plural(ready)}.${staleDetail}`,
      rationale:
        "Ces contacts réunissent les deux conditions d'une relance utile : une adresse valide et un statut encore ouvert. Les traiter d'abord concentre l'effort là où il peut aboutir, sans attendre de compléter le reste de la base.",
      data_sources: src,
      expected_impact: `${ready} relance${plural(ready)} adressée${plural(ready)} d'abord aux contacts les plus actionnables`,
      confidence: 0.75,
      risk: "low",
      payload: {
        count: ready,
        total,
        stale_count: staleAges.length,
        oldest_contact_days: oldestContactDays,
      },
    });
  }

  // Règle 3 — prospects sans statut → à classer (invisibles dans le funnel)
  const noStage = canonical.filter((p) => !(p.stage ?? "").trim()).length;
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
  for (const p of rawRows) {
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
  const noCompany = canonical.filter((p) => !(p.company ?? "").trim()).length;
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
