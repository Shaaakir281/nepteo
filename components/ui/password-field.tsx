"use client";

import { useState } from "react";
import { FIELD } from "./styles";

export function PasswordField({
  autoComplete,
  hint,
}: {
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? "password-hint" : undefined;

  return (
    <div>
      <label
        htmlFor="password"
        className="block text-[13px] font-semibold text-ink"
      >
        Mot de passe
      </label>
      <div className="relative mt-1">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          required
          minLength={8}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={hintId}
          className={`${FIELD} pr-[5.75rem]`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-controls="password"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-1 top-1/2 inline-flex min-h-10 min-w-[5rem] -translate-y-1/2 items-center justify-center rounded-[8px] px-2 text-xs font-semibold text-violet transition hover:bg-tint-soft"
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-body">
          {hint}
        </p>
      )}
    </div>
  );
}
