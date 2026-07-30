import { NextResponse } from "next/server";
import {
  READINESS_TIMEOUT_MS,
  supportsRequiredSchemaVersion,
} from "@/lib/readiness";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

async function isDatabaseReady(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), READINESS_TIMEOUT_MS);

  try {
    const { data, error } = await createAdminClient()
      .from("app_schema_version")
      .select("version")
      .eq("id", 1)
      .abortSignal(controller.signal)
      .single();

    return !error && supportsRequiredSchemaVersion(data?.version);
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    if (await isDatabaseReady()) {
      return NextResponse.json(
        { status: "ready" },
        { status: 200, headers: RESPONSE_HEADERS },
      );
    }
  } catch {
    // La réponse publique reste volontairement générique.
  }

  return NextResponse.json(
    { status: "unavailable" },
    { status: 503, headers: RESPONSE_HEADERS },
  );
}
