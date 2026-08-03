import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { PHILOSOPHY_MAX } from "@/lib/memory";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import { logout } from "@/app/(auth)/actions";
import { createOrganization } from "./actions";
import { GuidedOnboarding } from "./_components/guided-onboarding";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (membership) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-2xl py-10">
        <div className="flex items-center justify-center gap-2.5 font-display text-[17px] font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#6a5cf0] to-[#4a3fd0] text-sm font-bold text-white shadow-[0_4px_10px_rgba(90,79,224,.28)]">
            N
          </span>
          Nepteo
        </div>
        <div className="mt-5 rounded-[18px] border border-line-soft bg-white p-6 shadow-card sm:p-7">
          <GuidedOnboarding
            action={createOrganization}
            error={error}
            philosophyMax={PHILOSOPHY_MAX}
            scenarios={DEMO_SCENARIOS.map(({ id, label, pitch }) => ({
              id: id as "artisan" | "agence" | "ecommerce",
              label,
              pitch,
            }))}
          />
        </div>
        {/* Issue de secours : sans ça, un compte sans organisation est piégé
            ici (la page de connexion renvoie vers le cockpit, qui renvoie ici). */}
        <form action={logout} className="mt-2 text-center">
          <button
            type="submit"
            className="text-[11.5px] text-faint underline-offset-2 hover:text-muted hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
