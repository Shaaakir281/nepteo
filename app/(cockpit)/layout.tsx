import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { readDemoPresentation } from "@/lib/demo/presentation";
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
  // passer par `isDemoModeActive`. Un marqueur `demo` seul ne prouve pas que
  // toutes les données appartiennent au scénario d'exemple : la preuve complète
  // couvre sauvegarde, seed finalisé, prospects, campagnes, ventes et absence
  // de données apportées par le testeur.
  const { presentation: demoPresentation } = await readDemoPresentation(
    membership.organizationId,
  );

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
        demoPresentation={demoPresentation}
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
          {demoPresentation === "certified-demo" && (
            <div className="mb-5 rounded-[12px] border border-amber/25 bg-amber-tint px-4 py-3 text-[12.5px] leading-relaxed text-body">
              <b>Scénario d&apos;exemple Nepteo.</b> Ce jeu versionné contient
              uniquement des données d&apos;exemple et illustre les analyses et
              propositions de l&apos;agent. Aucun compte externe n&apos;est
              connecté et ces résultats ne comptent pas dans la preuve terrain.
            </div>
          )}
          {demoPresentation === "test-environment" && (
            <div className="mb-5 rounded-[12px] border border-violet/20 bg-tint px-4 py-3 text-[12.5px] leading-relaxed text-body">
              <b>Environnement de test.</b> Les données affichées peuvent avoir
              été saisies ou importées par le testeur (CSV ou connecteur), ou
              provenir d&apos;un scénario Nepteo. Vérifiez leur origine avant
              d&apos;utiliser les résultats comme preuve terrain.
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
