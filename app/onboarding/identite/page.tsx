import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/lib/memory";
import { IdentityWizard } from "./_components/identity-wizard";

/**
 * Onboarding, 2e écran — FACULTATIF. L'agent lit le site de l'entreprise et
 * propose une identité que l'utilisateur corrige avant de valider.
 * Rien n'est obligatoire : « Passer cette étape » entre directement au cockpit.
 */
export default async function IdentitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-2.5 font-display text-[17px] font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#6a5cf0] to-[#4a3fd0] text-sm font-bold text-white shadow-[0_4px_10px_rgba(90,79,224,.28)]">
            N
          </span>
          Nepteo
        </div>
        <div className="mt-5 rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
          <IdentityWizard
            activityOptions={[...ACTIVITY_OPTIONS]}
            audienceOptions={[...AUDIENCE_OPTIONS]}
            channelOptions={[...CHANNEL_OPTIONS]}
          />
        </div>
        <p className="mt-4 text-center text-[11.5px] text-faint">
          Tout reste modifiable depuis la vue Entreprise.
        </p>
      </div>
    </main>
  );
}
