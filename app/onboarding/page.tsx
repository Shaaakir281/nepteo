import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";

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

  // Déjà membre d'une organisation → cockpit.
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-center text-sm font-semibold text-accent">Nepteo</p>
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Votre entreprise</h1>
          <p className="mt-1 text-sm text-stone-500">
            Deux questions pour créer votre cockpit. Vous pourrez tout
            compléter plus tard.
          </p>
          <form action={createOrganization} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Nom de l&apos;entreprise
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="activity" className="block text-sm font-medium">
                Que vendez-vous, et à qui ?{" "}
                <span className="font-normal text-stone-400">(optionnel)</span>
              </label>
              <textarea
                id="activity"
                name="activity"
                rows={3}
                maxLength={300}
                placeholder="Ex. : formations IA pour pharmacies, coaching sportif pour seniors…"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Créer mon cockpit
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
