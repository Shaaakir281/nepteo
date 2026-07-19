import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import {
  getModel,
  providerKeyStatus,
  resolveSpec,
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

  let tier: LlmTier = "standard";
  try {
    const body = (await request.json().catch(() => ({}))) as { tier?: string };
    if (body.tier === "light" || body.tier === "premium") tier = body.tier;
  } catch {
    // corps vide accepté
  }

  const spec = resolveSpec(tier);
  const started = Date.now();
  try {
    const { text } = await generateText({
      model: getModel(tier),
      prompt: "Réponds uniquement : OK",
      maxOutputTokens: 8,
    });
    return NextResponse.json({
      ok: true,
      tier,
      model: spec,
      response: text.trim(),
      ms: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        tier,
        model: spec,
        error: e instanceof Error ? e.message : "Erreur inconnue",
      },
      { status: 502 },
    );
  }
}
