/**
 * Brouillons de relance — parties pures (aucune dépendance, aucun `@/` import).
 * Isolées ici pour être testables sans build (node:test, type-stripping) : le
 * gabarit de repli déterministe, le prédicat de ciblage, le parsing de sortie LLM.
 * L'orchestration LLM vit dans lib/draft.ts.
 */

export interface Draft {
  subject: string;
  body: string;
}

/** Types d'action « relance » qui méritent un message prêt à envoyer. */
export function isRelanceKind(kind: string): boolean {
  return kind === "relaunch_priority" || kind.startsWith("relaunch_stage_");
}

/** Première valeur non vide d'une section de mémoire (contenu jsonb libre). */
export function memoText(ctx: Record<string, unknown>, key: string): string {
  const v = ctx[key];
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    const first = Object.values(v as Record<string, unknown>).find(
      (x) => typeof x === "string" && x.trim(),
    );
    if (typeof first === "string") return first.trim();
  }
  return "";
}

/** Gabarit de repli — déterministe, sans LLM. Toujours un message correct. */
export function templateRelance(input: {
  stage?: string | null;
  activite?: string;
}): Draft {
  const stage = (input.stage ?? "").trim();
  const activite = (input.activite ?? "").trim();
  const subject = stage
    ? `Reprise de contact — où en êtes-vous ?`
    : `On reprend contact ?`;
  const intro = activite
    ? `Je me permets de revenir vers vous au sujet de ${activite}.`
    : `Je me permets de revenir vers vous suite à nos premiers échanges.`;
  const body = [
    `Bonjour {prénom},`,
    ``,
    intro,
    stage
      ? `Votre dossier en est à l'étape « ${stage} » et je voulais m'assurer que vous aviez tout ce qu'il vous faut pour avancer.`
      : `Je voulais m'assurer que vous aviez tout ce qu'il vous faut pour avancer.`,
    ``,
    `Seriez-vous disponible cette semaine pour un court échange ? Je m'adapte à votre agenda.`,
    ``,
    `Bien à vous,`,
  ].join("\n");
  return { subject, body };
}

/** Contexte d'un prospect pour la personnalisation d'un brouillon. */
export interface ProspectContext {
  name?: string | null;
  company?: string | null;
  stage?: string | null;
  notes?: string | null;
  raw?: Record<string, unknown>;
}

/** Colonnes brutes non vides (string/number), hors valeurs déjà citées, bornées. */
function renderRaw(
  raw: Record<string, unknown>,
  used: Set<string>,
  maxFields = 12,
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (parts.length >= maxFields) break;
    let val = "";
    if (typeof v === "string") val = v.trim();
    else if (typeof v === "number" && Number.isFinite(v)) val = String(v);
    else continue;
    if (!val || used.has(val)) continue;
    if (val.length > 120) val = `${val.slice(0, 117)}…`;
    parts.push(`${k} : ${val}`);
  }
  return parts.join(" ; ");
}

/**
 * Résumé texte d'un prospect pour personnaliser un brouillon : champs connus +
 * notes personnelles + toutes les autres colonnes brutes non vides. Pur et borné
 * (évite d'injecter des payloads énormes dans le prompt).
 */
export function renderProspectContext(p: ProspectContext): string {
  const lines: string[] = [];
  const name = (p.name ?? "").trim();
  const company = (p.company ?? "").trim();
  const stage = (p.stage ?? "").trim();
  const notes = (p.notes ?? "").trim();
  if (name) lines.push(`Nom : ${name}`);
  if (company) lines.push(`Entreprise : ${company}`);
  if (stage) lines.push(`Statut : ${stage}`);
  if (notes) lines.push(`Notes personnelles : ${notes}`);
  const used = new Set([name, company, stage, notes].filter(Boolean));
  const extra = renderRaw(p.raw ?? {}, used);
  if (extra) lines.push(`Autres infos : ${extra}`);
  return lines.join("\n");
}

/** Découpe une sortie LLM « Objet: …\n\n<corps> » en {subject, body}. */
export function parseDraft(text: string): Draft | null {
  const t = text.trim();
  const m = t.match(/^\s*objet\s*:\s*(.+?)\s*(?:\n|$)/i);
  if (!m) return null;
  const subject = m[1].trim();
  const body = t.slice(m.index! + m[0].length).trim();
  if (!subject || body.length < 20) return null;
  return { subject, body };
}
