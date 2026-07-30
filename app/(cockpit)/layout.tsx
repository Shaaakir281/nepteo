import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_PROVIDER } from "@/lib/demo/isolation-rules";
import { icons } from "@/components/icons";
import { Sidebar } from "./_components/sidebar";
import { MobileCockpitNav } from "./_components/nav";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  marketing: "Marketing",
  commercial: "Commercial",
  direction: "Direction",
  lecture: "Lecture",
};

export default async function CockpitLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  // Le bandeau est informatif, pas un garde-fou : les mutations continuent de
  // passer par `isDemoModeActive`. Une seule lecture du marqueur de confiance
  // suffit ici pour rendre le contexte fictif visible sur tout le cockpit.
  const { data: demoConnectors } = await createAdminClient()
    .from("connectors")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .eq("provider", DEMO_PROVIDER)
    .contains("config", { demo: true })
    .limit(1);
  const demoActive = (demoConnectors?.length ?? 0) > 0;

  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  const raw = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const today = raw.charAt(0).toUpperCase() + raw.slice(1); // « Dimanche 19 juillet »

  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr] max-lg:grid-cols-1">
      <Sidebar
        orgName={membership.organizationName ?? "Mon entreprise"}
        email={user.email ?? ""}
        roleLabel={ROLE_LABELS[membership.role] ?? membership.role}
        initial={initial}
        canViewFinancials={membership.canViewFinancials}
        demoActive={demoActive}
      />

      <div className="min-w-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line-soft bg-white px-7 py-3">
          <span className="font-display text-[15px] font-semibold text-ink lg:hidden">
            Nepteo
          </span>
          <span className="hidden items-center gap-2 text-[13px] text-faint lg:flex">
            {icons.search}
            Rechercher une campagne, un prospect…
          </span>
          <div className="flex items-center gap-3.5">
            <span className="text-[12.5px] text-muted">{today}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-display text-[11.5px] font-semibold text-white">
              {initial}
            </span>
          </div>
        </div>
        <main className="mx-auto max-w-[1060px] px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:pb-8">
          {demoActive && (
            <div className="mb-5 rounded-[12px] border border-amber/25 bg-amber-tint px-4 py-3 text-[12.5px] leading-relaxed text-body">
              <b>Démonstration active — données fictives.</b>{" "}
              Ce jeu de données illustre les analyses et propositions de
              l&apos;agent. Aucun compte externe n&apos;est connecté et ces
              résultats ne comptent pas dans la preuve terrain.
            </div>
          )}
          {children}
        </main>
      </div>
      <MobileCockpitNav
        canViewFinancials={membership.canViewFinancials}
      />
    </div>
  );
}
