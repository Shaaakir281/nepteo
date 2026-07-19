import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./(auth)/actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  marketing: "Marketing",
  commercial: "Commercial",
  direction: "Direction",
  lecture: "Lecture",
};

const modules = [
  {
    title: "Aujourd'hui",
    description: "KPIs, alertes et journal de l'agent.",
    phase: "Phase 1",
  },
  {
    title: "Actions à valider",
    description: "L'agent propose, vous gardez le contrôle.",
    phase: "Phase 2",
  },
  {
    title: "Connecteurs",
    description: "CRM, analytics, publicité, email, paiements.",
    phase: "Phase 1",
  },
  {
    title: "Agent & garde-fous",
    description: "Autonomie, plafonds, règles de validation.",
    phase: "Phase 3",
  },
];

export default async function Home() {
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Nepteo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {org?.name ?? "Cockpit"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
            {ROLE_LABELS[membership.role] ?? membership.role}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <div
            key={m.title}
            className="rounded-xl border border-stone-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{m.title}</h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                {m.phase}
              </span>
            </div>
            <p className="mt-2 text-sm text-stone-600">{m.description}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm text-stone-400">
        Connecté en tant que {user.email}
      </p>
    </main>
  );
}
