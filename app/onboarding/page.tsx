import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PHILOSOPHY_MAX } from "@/lib/memory";
import { logout } from "@/app/(auth)/actions";
import { createOrganization } from "./actions";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
  if (membership) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 font-display text-[17px] font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#6a5cf0] to-[#4a3fd0] text-sm font-bold text-white shadow-[0_4px_10px_rgba(90,79,224,.28)]">
            N
          </span>
          Nepteo
        </div>
        <div className="mt-5 rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
          <h1 className="text-xl font-semibold">Votre entreprise</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Le nom suffit pour démarrer. Plus vous en dites, mieux Nepteo vous
            comprend — et tout reste modifiable depuis la vue Entreprise.
          </p>
          <form action={createOrganization} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-[13px] font-semibold text-ink">
                Nom de l&apos;entreprise
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="activity" className="block text-[13px] font-semibold text-ink">
                Que vendez-vous, et à qui ?{" "}
                <span className="font-normal text-faint">(facultatif)</span>
              </label>
              <textarea
                id="activity"
                name="activity"
                rows={3}
                maxLength={300}
                placeholder="Décrivez simplement, comme vous le feriez à un client — pas besoin des bons termes marketing."
                className={FIELD}
              />
            </div>
            <div>
              <label
                htmlFor="philosophy"
                className="block text-[13px] font-semibold text-ink"
              >
                Votre philosophie{" "}
                <span className="font-normal text-faint">(facultatif)</span>
              </label>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                Votre façon de travailler, ce à quoi vous tenez, ce que vous ne
                diriez jamais. Nepteo s&apos;en sert pour écrire comme vous.
              </p>
              <textarea
                id="philosophy"
                name="philosophy"
                rows={4}
                maxLength={PHILOSOPHY_MAX}
                placeholder="Exemple : je travaille en direct, sans intermédiaire. Je préfère perdre une vente que promettre ce que je ne peux pas tenir."
                className={FIELD}
              />
            </div>
            {error && (
              <p className="rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] font-medium text-red">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-[10px] bg-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
            >
              Créer mon cockpit
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[11.5px] text-faint">
          Toutes vos réponses pourront être modifiées plus tard.
        </p>
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
