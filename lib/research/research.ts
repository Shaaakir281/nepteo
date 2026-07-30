import type { createAdminClient } from "@/lib/supabase/admin";
import { askResearch, researchProvider } from "@/lib/research/provider";
import {
  guardResearch,
  isFresh,
  MAX_RESEARCH_PER_DAY,
  readQuotaReservation,
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

function readSources(raw: unknown): ResearchSource[] {
  return Array.isArray(raw) ? (raw as ResearchSource[]) : [];
}

async function recordBlocked(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string | null;
    kind: ResearchKind;
    subject: string;
    force?: boolean;
  },
  reason: string,
): Promise<void> {
  await admin.from("journal").insert({
    organization_id: args.orgId,
    event: "research_blocked",
    actor: "agent",
    actor_id: args.actorId,
    payload: {
      kind: args.kind,
      subject: args.subject,
      reason,
      force: Boolean(args.force),
    },
  });
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
    const { data: cached, error: cacheError } = await admin
      .from("research_runs")
      .select("answer, sources, status, created_at")
      .eq("organization_id", args.orgId)
      .eq("kind", args.kind)
      .eq("subject_key", key)
      .maybeSingle();
    if (cacheError) {
      await recordBlocked(admin, args, "cache_unavailable");
      return { ok: false, reason: "cache_unavailable" };
    }
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

  // 2. Garde-fous purs sans dépense : fournisseur configuré et sujet.
  const provider = researchProvider();
  const guard = guardResearch({
    hasKey: provider !== null,
    subject: args.subject,
  });
  if (!guard.ok) {
    await recordBlocked(admin, args, guard.reason);
    return { ok: false, reason: guard.reason };
  }
  if (!provider) {
    await recordBlocked(admin, args, "no_key");
    return { ok: false, reason: "no_key" };
  }

  // 3. Réservation atomique AVANT l'appel. Le compteur d'usage est distinct du
  // cache : un `force` et un échec fournisseur consomment eux aussi un créneau.
  const { data: quotaData, error: quotaError } = await admin.rpc(
    "reserve_research_call",
    {
      p_organization_id: args.orgId,
      p_daily_limit: MAX_RESEARCH_PER_DAY,
    },
  );
  const quota = readQuotaReservation(quotaData);
  if (quotaError || !quota) {
    await recordBlocked(admin, args, "quota_unavailable");
    return { ok: false, reason: "quota_unavailable" };
  }
  if (!quota.allowed) {
    await recordBlocked(admin, args, quota.reason);
    return { ok: false, reason: quota.reason };
  }

  // 4. Journal AVANT l'appel externe (non négociable, cf. CLAUDE.md).
  const { error: journalError } = await admin.from("journal").insert({
    organization_id: args.orgId,
    event: "research_started",
    actor: "agent",
    actor_id: args.actorId,
    payload: {
      kind: args.kind,
      subject: args.subject,
      subject_key: key,
      provider,
      force: Boolean(args.force),
      quota_used: quota.used,
    },
  });
  if (journalError) {
    return { ok: false, reason: "journal_unavailable" };
  }

  const result = await askResearch({ kind: args.kind, query: args.query });

  // 5. Trace du résultat + cache (échec compris : il compte dans le plafond,
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
    // `searches` = nombre de recherches réellement facturées par l'appel (chez
    // OpenAI, une requête peut en enchaîner plusieurs). Le plafond quotidien
    // compte des appels `runResearch` : sans ce chiffre au journal, il mentirait.
    payload: result.ok
      ? {
          kind: args.kind,
          subject: args.subject,
          sources: result.sources.length,
          provider,
          ...(typeof result.searches === "number" ? { searches: result.searches } : {}),
        }
      : { kind: args.kind, subject: args.subject, reason: result.reason, provider },
  });

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, cached: false, text: result.text, sources: result.sources };
}
