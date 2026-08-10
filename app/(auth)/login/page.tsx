import Link from "next/link";
import { login } from "../actions";
import { PasswordField } from "@/components/ui/password-field";
import { FIELD } from "@/components/ui/styles";

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
          <input id="email" name="email" type="email" required autoComplete="username" className={`${FIELD} mt-1`} />
        </div>
        <PasswordField autoComplete="current-password" />
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
