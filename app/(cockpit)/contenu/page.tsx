import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDIT_ROLES } from "@/lib/memory";
import { memoText } from "@/lib/draft-template";
import {
  computeFunnelStats,
  type BriefingProspect,
} from "@/lib/analysis-rules";
import {
  deriveKpis,
  rollupByCampaign,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";
import { buildCreativeSuggestions } from "@/lib/creative-template";
import { CreativeWorkspace } from "./_components/creative-workspace";

export default async function ContenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const canEdit = EDIT_ROLES.includes(membership.role);

  // Idées proposées par l'agent, à partir de ce qu'il sait déjà.
  const { data: mem } = await supabase
    .from("company_memory")
    .select("section, content")
    .in("section", ["offres", "activite"]);
  const memCtx = Object.fromEntries(
    (mem ?? []).map((m) => [m.section, m.content]),
  );
  const offre = memoText(memCtx, "offres") || memoText(memCtx, "activite");

  const { data: prospectRows } = await supabase
    .from("prospects")
    .select("email, stage, company");
  const stats = computeFunnelStats((prospectRows ?? []) as BriefingProspect[]);

  const { data: adRows } = await supabase
    .from("ad_metrics")
    .select("campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue")
    .eq("provider", "meta_ads");
  const losingCampaigns = rollupByCampaign(
    (adRows ?? []).map((r) => ({
      ...r,
      spend: Number(r.spend),
      revenue: Number(r.revenue),
    })) as CampaignMetric[],
  )
    .map(deriveKpis)
    .filter((c) => c.spend >= 50 && c.roas < 1)
    .map((c) => c.campaign_name);

  const suggestions = buildCreativeSuggestions({
    offre,
    priorityCount: stats.priority,
    losingCampaigns,
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Contenu</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          L&apos;agent prépare un conseil créatif à partir de votre{" "}
          <Link href="/entreprise" className="font-semibold text-violet hover:underline">
            mémoire d&apos;entreprise
          </Link>{" "}
          : angles, accroches et brief prêts à transmettre. Aucun lancement, aucune
          dépense — juste du contenu que vous validez.
        </p>
      </div>

      <CreativeWorkspace canEdit={canEdit} suggestions={suggestions} />
    </>
  );
}
