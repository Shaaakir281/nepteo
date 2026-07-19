import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import {
  getModel,
  getModelForTask,
  LLM_TASKS,
  providerKeyStatus,
  resolveSpec,
  resolveTaskSpec,
  type LlmTask,
  type LlmTier,
} from "@/lib/llm";

async function requireMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  return membership ? { user, role: membership.role as string } : null;
}

/** Configuration LLM (specs + présence des clés) — aucun appel facturé. */
export async function GET() {
  const auth = await requireMember();
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json({
    tiers: {
      light: resolveSpec("light"),
      standard: resolveSpec("standard"),
      premium: resolveSpec("premium"),
    },
    tasks: Object.fromEntries(
      (Object.keys(LLM_TASKS) as LlmTask[]).map((t) => [t, resolveTaskSpec(t)]),
    ),
    keys: providerKeyStatus(),
  });
}

/** Ping réel du modèle (admin uniquement — appel facturé, volontairement minuscule). */
export async function POST(request: Request) {
  const auth = await requireMember();
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Réservé au rôle admin" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    tier?: string;
    task?: string;
  };

  let label: string;
  let spec: string;
  let model;
  if (body.task && body.task in LLM_TASKS) {
    const task = body.task as LlmTask;
    label = `task:${task}`;
    spec = resolveTaskSpec(task);
    model = getModelForTask(task);
  } else {
    const tier: LlmTier =
      body.tier === "light" || body.tier === "premium" ? body.tier : "standard";
    label = `tier:${tier}`;
    spec = resolveSpec(tier);
    model = getModel(tier);
  }

  const started = Date.now();
  try {
    const { text } = await generateText({
      model,
      prompt: "Réponds uniquement : OK",
      maxOutputTokens: 8,
    });
    return NextResponse.json({
      ok: true,
      target: label,
      model: spec,
      response: text.trim(),
      ms: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        target: label,
        model: spec,
        error: e instanceof Error ? e.message : "Erreur inconnue",
      },
      { status: 502 },
    );
  }
}
