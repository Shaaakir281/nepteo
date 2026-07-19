import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { icons } from "@/components/icons";
import { Sidebar } from "./_components/sidebar";

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
      <Sidebar
        orgName={org?.name ?? "Mon entreprise"}
        email={user.email ?? ""}
        roleLabel={ROLE_LABELS[membership.role] ?? membership.role}
        initial={initial}
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
