import Link from "next/link";
import { login } from "../actions";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold">Connexion</h1>
      <p className="mt-1 text-[13px] text-muted">
        Retrouvez votre cockpit et vos actions à valider.
      </p>
      <form action={login} className="mt-6 space-y-4">
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
          <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" className={FIELD} />
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
          Se connecter
        </button>
      </form>
      <p className="mt-4 text-[13px] text-muted">
        Pas de compte ?{" "}
        <Link href="/signup" className="font-semibold text-violet hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
