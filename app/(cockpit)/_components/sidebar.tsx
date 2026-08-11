import { icons } from "@/components/icons";
import { logout } from "@/app/(auth)/actions";
import Link from "next/link";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import { CockpitNav } from "./nav";
import { WalkthroughSidebarLink } from "./walkthrough-link";

/**
 * Cinq entrées, pas neuf. « Plan du mois » a rejoint Aujourd'hui (bandeau de
 * cap) ; « Connecteurs » et « Agent & garde-fous » sont devenus des onglets de
 * « Mon entreprise » ; « Contenu » reste un atelier, atteint depuis le cap du
 * mois et depuis Campagnes — plus une entrée de menu. Toutes les anciennes
 * URLs redirigent. Voir docs/DECISIONS.md (ADR « navigation à cinq entrées »).
 */
export function Sidebar({
  orgName,
  email,
  roleLabel,
  initial,
  canEdit,
  canViewFinancials,
  demoPresentation,
}: {
  orgName: string;
  email: string;
  roleLabel: string;
  initial: string;
  canEdit: boolean;
  canViewFinancials: boolean;
  demoPresentation: DemoPresentation;
}) {
  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-line bg-white max-lg:hidden">
      <div className="flex items-baseline gap-2 px-5 pb-5 pt-5 font-display text-[20px] font-light tracking-[.02em] text-ink">
        nept<span className="-ml-2 text-[#c9a7a0]">e</span>o
        <span className="rounded border border-line px-1.5 py-0.5 font-sans text-[8px] font-semibold uppercase tracking-[.13em] text-muted">
          Growth
        </span>
      </div>
      <div className="mx-3.5 mb-3.5 rounded-[10px] border border-line bg-tint-soft px-3 py-[9px] text-[12.5px]">
        <b className="block truncate font-semibold text-ink">{orgName}</b>
        {demoPresentation !== "none" && (
          <span className="mt-1 inline-flex rounded-full bg-amber-tint px-2 py-0.5 text-[10.5px] font-semibold text-amber">
            {demoPresentation === "certified-demo"
              ? "Scénario d'exemple Nepteo"
              : "Environnement de test"}
          </span>
        )}
      </div>

      {canEdit && (
        <Link
          href="/contenu"
          className="mx-3.5 mb-4 flex items-center justify-center gap-2 rounded-[9px] bg-[#8a232d] px-3 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_rgba(138,35,45,.16)] transition hover:bg-[#741d25]"
        >
          {icons.sparkle}
          Créer un visuel
        </Link>
      )}
      <CockpitNav canViewFinancials={canViewFinancials} />

      <div className="min-h-4 flex-1" />

      <WalkthroughSidebarLink />

      <div className="mx-3.5 flex-none rounded-[10px] border border-line bg-tint-soft p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-none rounded-full bg-green" />
          <h4 className="font-display text-[12.5px] font-semibold">
            Agent en mode sûr
          </h4>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          Il prépare. Vous validez avant tout envoi.
        </p>
      </div>

      <div className="m-3.5 flex flex-none items-center gap-2.5 rounded-[10px] px-2 py-1.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink font-display text-[11.5px] font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-ink">
            {email}
          </p>
          <p className="text-[11px] text-muted">{roleLabel}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Se déconnecter"
            className="rounded-[8px] p-1.5 text-faint transition hover:bg-tint-soft hover:text-ink"
          >
            {icons.logout}
          </button>
        </form>
      </div>
    </aside>
  );
}
