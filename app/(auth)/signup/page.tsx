import Link from "next/link";
import { resendConfirmation, signup } from "../actions";
import { PasswordField } from "@/components/ui/password-field";
import { FIELD } from "@/components/ui/styles";

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
          <input id="email" name="email" type="email" required autoComplete="email" className={`${FIELD} mt-1`} />
        </div>
        <PasswordField
          autoComplete="new-password"
          hint="8 caractères minimum."
        />
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

      <section id="resend-confirmation" className="mt-6 border-t border-line-soft pt-5">
        <h2 className="text-[14px] font-semibold text-ink">Email non reçu ?</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Renseigne l&apos;adresse utilisée lors de l&apos;inscription. Le message peut
          aussi se trouver dans les courriers indésirables.
        </p>
        <form action={resendConfirmation} className="mt-3 space-y-3">
          <div>
            <label htmlFor="resend-email" className="block text-[13px] font-semibold text-ink">
              Email
            </label>
            <input
              id="resend-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={`${FIELD} mt-1`}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-line bg-white px-4 py-2.5 text-sm font-semibold text-violet transition hover:bg-tint-soft"
          >
            Renvoyer le lien de confirmation
          </button>
        </form>
      </section>
    </>
  );
}
