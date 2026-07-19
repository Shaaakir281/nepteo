import Link from "next/link";
import { signup } from "../actions";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold">Créer un compte</h1>
      <p className="mt-1 text-[13px] text-muted">
        Quelques minutes suffisent pour préparer votre cockpit.
      </p>
      <form action={signup} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-[13px] font-semibold text-ink">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={FIELD} />
        </div>
        <div>
          <label htmlFor="password" className="block text-[13px] font-semibold text-ink">
            Mot de passe
          </label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={FIELD} />
          <p className="mt-1 text-xs text-faint">8 caractères minimum.</p>
        </div>
        {error && (
          <p className="rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] font-medium text-red">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-[10px] bg-green-tint px-3.5 py-2.5 text-[13px] font-medium text-green">
            {message}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-[10px] bg-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
        >
          Créer mon compte
        </button>
      </form>
      <p className="mt-4 text-[13px] text-muted">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-semibold text-violet hover:underline">
          Connexion
        </Link>
      </p>
    </>
  );
}
