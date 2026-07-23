import { icons } from "@/components/icons";
import { logout } from "@/app/(auth)/actions";
import { CockpitNav, type NavItem } from "./nav";

const PILOTAGE: NavItem[] = [
  { label: "Aujourd'hui", href: "/", icon: icons.star },
  { label: "Campagnes", href: "/campagnes", icon: icons.send },
  { label: "Prospects", href: "/prospects", icon: icons.people },
  { label: "Contenu", soon: "Phase 4", icon: icons.pen },
];

const SYSTEME: NavItem[] = [
  { label: "Entreprise", href: "/entreprise", icon: icons.house },
  { label: "Connecteurs", href: "/connecteurs", icon: icons.link },
  { label: "Journal", href: "/journal", icon: icons.journal },
  { label: "Agent & garde-fous", soon: "Phase 3", icon: icons.shield },
];

export function Sidebar({
  orgName,
  email,
  roleLabel,
  initial,
}: {
  orgName: string;
  email: string;
  roleLabel: string;
  initial: string;
}) {
  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-line-soft bg-white max-lg:hidden">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5 font-display text-[17px] font-bold text-ink">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-gradient-to-br from-[#6a5cf0] to-[#4a3fd0] text-sm font-bold text-white shadow-[0_4px_10px_rgba(90,79,224,.28)]">
          N
        </span>
        Nepteo
      </div>
      <div className="mx-3.5 mb-3.5 rounded-[10px] border border-line bg-tint-soft px-3 py-[9px] text-[12.5px]">
        <b className="block truncate font-semibold text-ink">{orgName}</b>
      </div>

      <div className="px-[22px] pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[.12em] text-faint">
        Pilotage
      </div>
      <CockpitNav items={PILOTAGE} />
      <div className="px-[22px] pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[.12em] text-faint">
        Système
      </div>
      <CockpitNav items={SYSTEME} />

      <div className="min-h-4 flex-1" />

      <div className="mx-3.5 flex-none rounded-[13px] border border-line bg-tint-soft p-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-none rounded-full bg-amber" />
          <h4 className="font-display text-[13px] font-semibold">
            Agent Nepteo — en préparation
          </h4>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Phase 1 : l&apos;agent apprend votre entreprise. Aucune action
          automatique — tout sera consigné au journal.
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
