"use client";

import { useFormStatus } from "react-dom";

export function OnboardingSubmitButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[10px] bg-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Création de l’espace…" : children}
    </button>
  );
}
