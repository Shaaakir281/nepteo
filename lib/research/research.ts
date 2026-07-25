import type { createAdminClient } from "@/lib/supabase/admin";
import { askPerplexity, researchConfigured } from "@/lib/research/perplexity";
import {
  guardResearch,
  isFresh,
  RESEARCH_PRESETS,
  subjectKey,
  type ResearchAnswer,
  type ResearchKind,
  type ResearchSource,
} from "@/lib/research/research-rules";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Orchestration d'une recherche web : cache, garde-fous serveur, journal.
 * Une recherche est un APPEL EXTERNE PAYANT — même discipline que l'exécution :
 * garde-fous d'abord, écriture au journal AVANT l'appel, résultat tracé ensuite.
 * Ne lève jamais : l'appelant reçoit toujours un résultat exploitable.
 */

export type ResearchResult =
  | ({ ok: true; cached: boolean } & ResearchAnswer)
  | { ok: false; reason: string };

/** Début du jour (UTC) — fenêtre du plafond quotidien, comme l'exécution. */
function startOfDayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function readSources(raw: unknown): ResearchSource[] {
  return Array.isArray(raw) ? (raw as ResearchSource[]) : [];
}

/**
 * Lance (ou réutilise) une recherche pour un sujet donné.
 * `subject` sert de clé de cache : un même nom d'entreprise n'est payé qu'une
 * fois par période. `force` ignore le cache (re-recherche explicite).
 */
export async function runResearch(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string | null;
    kind: ResearchKind;
    subject: string;
    query: string;
    force?: boolean;
  },
): Promise<ResearchResult> {
  const key = subjectKey(args.subject);

  // 1. Cache — aucun appel, aucune dépense.
  if (key && !args.force) {
    const { data: cached } = await admin
      .from("research_runs")
      .select("answer, sources, status, created_at")
      .eq("organization_id", args.orgId)
      .eq("kind", args.kind)
      .eq("subject_key", key)
      .maybeSingle();
    if (
      cached &&
      cached.status === "ok" &&
      cached.answer &&
      isFresh(cached.created_at as string)
    ) {
      return {
        ok: true,
        cached: true,
        text: cached.answer as string,
        sources: readSources(cached.sources),
      };
    }
  }

  // 2. Garde-fous serveur : clé, bouton d'arrêt, sujet, plafond du jour.
  const { data: org } = await admin
    .from("organizations")
    .select("execution_paused")
    .eq("id", args.orgId)
    .maybeSingle();

  const { count } = await admin
    .from("research_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.orgId)
    .gte("created_at", startOfDayISO());

  const guard = guardResearch({
    hasKey: researchConfigured(),
    paused: Boolean(org?.execution_paused),
    subject: args.subject,
    usedToday: count ?? 0,
  });
  if (!guard.ok) {
    await admin.from("journal").insert({
      organization_id: args.orgId,
      event: "research_blocked",
      actor: "agent",
      actor_id: args.actorId,
      payload: { kind: args.kind, subject: args.subject, reason: guard.reason },
    });
    return { ok: false, reason: guard.reason };
  }

  // 3. Journal AVANT l'appel externe (non négociable, cf. CLAUDE.md).
  await admin.from("journal").insert({
    organization_id: args.orgId,
    event: "research_started",
    actor: "agent",
    actor_id: args.actorId,
    payload: { kind: args.kind, subject: args.subject, subject_key: key },
  });

  const result = await askPerplexity({
    query: args.query,
    preset: RESEARCH_PRESETS[args.kind],
  });

  // 4. Trace du résultat + cache (échec compris : il compte dans le plafond,
  //    sinon une clé invalide permettrait de boucler indéfiniment).
  await admin.from("research_runs").upsert(
    {
      organization_id: args.orgId,
      kind: args.kind,
      subject_key: key,
      subject_label: args.subject.slice(0, 200),
      query: args.query,
      answer: result.ok ? result.text : "",
      sources: result.ok ? result.sources : [],
      status: result.ok ? "ok" : "failed",
      created_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,kind,subject_key" },
  );

  await admin.from("journal").insert({
    organization_id: args.orgId,
    event: result.ok ? "research_succeeded" : "research_failed",
    actor: "agent",
    actor_id: args.actorId,
    payload: result.ok
      ? { kind: args.kind, subject: args.subject, sources: result.sources.length }
      : { kind: args.kind, subject: args.subject, reason: result.reason },
  });

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, cached: false, text: result.text, sources: result.sources };
}
