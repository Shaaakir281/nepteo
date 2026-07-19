import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import { CockpitNav, type NavItem } from "./nav";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  marketing: "Marketing",
  commercial: "Commercial",
  direction: "Direction",
  lecture: "Lecture",
};

const ic = {
  star: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8l1.8 4.3 4.7.4-3.6 3.1 1.1 4.6L8 11.7l-4 2.5 1.1-4.6-3.6-3.1 4.7-.4L8 1.8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  send: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 2.5L7 9M13.5 2.5l-4 11-2.5-5-5-2.5 11.5-3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  people: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 13c.5-2.3 2-3.5 4-3.5s3.5 1.2 4 3.5M11 6.5c1.2.2 2.3 1 2.8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  pen: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10L11 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3.5 14h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  house: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 13.5V5.8L8 2l5.5 3.8v7.7M2.5 13.5h11M6 13.5V9.8h4v3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  link: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M6.5 9.5l3-3M5 11l-1.2 1.2a2.5 2.5 0 01-3.5-3.5L2.5 7M11 5l1.2-1.2a2.5 2.5 0 013.5 3.5L13.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8l6 2.4v4.2c0 3.6-2.4 6.3-6 7.8-3.6-1.5-6-4.2-6-7.8V4.2l6-2.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
};

const PILOTAGE: NavItem[] = [
  { label: "Aujourd'hui", href: "/", icon: ic.star },
  { label: "Campagnes", soon: "Phase 4", icon: ic.send },
  { label: "Prospects", soon: "Phase 2", icon: ic.people },
  { label: "Contenu", soon: "Phase 4", icon: ic.pen },
];

const SYSTEME: NavItem[] = [
  { label: "Entreprise", href: "/entreprise", icon: ic.house },
  { label: "Connecteurs", soon: "Bientôt", icon: ic.link },
  { label: "Agent & garde-fous", soon: "Phase 3", icon: ic.shield },
];

export default async function CockpitLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations(name)")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const org = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr] max-lg:grid-cols-1">
      {/* ===== Sidebar ===== */}
      <aside className="sticky top-0 flex h-screen flex-col border-r border-line-soft bg-white max-lg:hidden">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5 font-display text-[17px] font-bold text-ink">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-gradient-to-br from-[#6a5cf0] to-[#4a3fd0] text-sm font-bold text-white shadow-[0_4px_10px_rgba(90,79,224,.28)]">
            N
          </span>
          Nepteo
        </div>
        <div className="mx-3.5 mb-3.5 rounded-[10px] border border-line bg-tint-soft px-3 py-[9px] text-[12.5px]">
          <b className="block truncate font-semibold text-ink">{org?.name}</b>
        </div>

        <div className="px-[22px] pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[.12em] text-faint">
          Pilotage
        </div>
        <CockpitNav items={PILOTAGE} />
        <div className="px-[22px] pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[.12em] text-faint">
          Système
        </div>
        <CockpitNav items={SYSTEME} />

        <div className="flex-1" />

        <div className="mx-3.5 rounded-[13px] border border-line bg-tint-soft p-3.5">
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

        <div className="m-3.5 flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink font-display text-[11.5px] font-semibold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-ink">
              {user.email}
            </p>
            <p className="text-[11px] text-muted">
              {ROLE_LABELS[membership.role] ?? membership.role}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Se déconnecter"
              className="rounded-[8px] p-1.5 text-faint transition hover:bg-tint-soft hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3.5a1 1 0 01-1-1V3a1 1 0 011-1H6M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <div className="min-w-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line-soft bg-white px-7 py-3">
          <span className="font-display text-[15px] font-semibold text-ink lg:hidden">
            Nepteo
          </span>
          <span className="hidden items-center gap-2 text-[13px] text-faint lg:flex">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Rechercher une campagne, un prospect…
          </span>
          <div className="flex items-center gap-3.5">
            <span className="text-[12.5px] capitalize text-muted">{today}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-display text-[11.5px] font-semibold text-white">
              {initial}
            </span>
          </div>
        </div>
        <main className="mx-auto max-w-[1060px] px-7 py-8">{children}</main>
      </div>
    </div>
  );
}
