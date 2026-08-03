"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { WalkthroughScenario } from "@/lib/onboarding/walkthrough";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";

interface ScenarioChoice {
  id: WalkthroughScenario;
  label: string;
  pitch: string;
}

function SubmitButton({ children }: { children: React.ReactNode }) {
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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 text-[12.5px] font-semibold text-muted hover:text-ink hover:underline"
    >
      ← Revenir au choix
    </button>
  );
}

export function GuidedOnboarding({
  action,
  error,
  philosophyMax,
  scenarios,
}: {
  action: (formData: FormData) => Promise<void>;
  error?: string;
  philosophyMax: number;
  scenarios: ScenarioChoice[];
}) {
  const [screen, setScreen] = useState<"choice" | "example" | "real">(
    error ? "real" : "choice",
  );
  const [scenario, setScenario] = useState<WalkthroughScenario>(
    scenarios[0]?.id ?? "artisan",
  );

  if (screen === "choice") {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-violet">
          Bienvenue dans Nepteo
        </p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight">
          Choisissez votre prise en main
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Découvrez d’abord le cycle complet sur des données d’exemple, ou
          configurez directement votre entreprise. Vous pourrez rouvrir le
          parcours à tout moment depuis le cockpit.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setScreen("example")}
            className="rounded-[14px] border border-violet/30 bg-tint-soft p-4 text-left transition hover:border-violet hover:bg-tint"
          >
            <span className="inline-flex rounded-full bg-violet px-2 py-0.5 text-[10.5px] font-semibold text-white">
              Recommandé
            </span>
            <span className="mt-3 block font-display text-[15px] font-semibold text-ink">
              Découvrir avec un scénario d’exemple
            </span>
            <span className="mt-1.5 block text-[12px] leading-relaxed text-muted">
              Analysez une entreprise fictive cohérente, examinez une priorité
              et prenez une décision sans utiliser vos données.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScreen("real")}
            className="rounded-[14px] border border-line bg-white p-4 text-left transition hover:border-violet/50 hover:bg-tint-soft"
          >
            <span className="inline-flex rounded-full bg-tint px-2 py-0.5 text-[10.5px] font-semibold text-violet-ink">
              Mon entreprise
            </span>
            <span className="mt-3 block font-display text-[15px] font-semibold text-ink">
              Configurer mon entreprise
            </span>
            <span className="mt-1.5 block text-[12px] leading-relaxed text-muted">
              Donnez le contexte essentiel, puis contrôlez la proposition
              d’identité issue de votre site avant tout enregistrement.
            </span>
          </button>
        </div>

        <div className="mt-5 rounded-[11px] bg-green-tint px-3.5 py-3 text-[12px] leading-relaxed text-body">
          <b className="text-green">Mode sûr :</b> le parcours guide vers les
          vrais écrans, mais ne lance aucun appel payant, ne charge aucune donnée
          et n’envoie rien sans une action explicite de votre part.
        </div>
      </div>
    );
  }

  if (screen === "example") {
    return (
      <div>
        <BackButton onClick={() => setScreen("choice")} />
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-violet">
          Parcours de découverte
        </p>
        <h1 className="mt-2 text-xl font-semibold">
          Choisissez une entreprise d’exemple
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Le choix est mémorisé seulement pour votre prise en main. Le
          chargement du scénario restera une action distincte et explicite dans
          le cockpit.
        </p>

        <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Scénario">
          {scenarios.map((item) => {
            const selected = item.id === scenario;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setScenario(item.id)}
                className={`w-full rounded-[12px] border px-4 py-3 text-left transition ${
                  selected
                    ? "border-violet bg-tint-soft ring-[3px] ring-violet/10"
                    : "border-line bg-white hover:border-violet/40"
                }`}
              >
                <span className="block text-[13.5px] font-semibold text-ink">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                  {item.pitch}
                </span>
              </button>
            );
          })}
        </div>

        <form action={action} className="mt-5">
          <input type="hidden" name="name" value="Espace découverte Nepteo" />
          <input type="hidden" name="onboarding_path" value="example" />
          <input type="hidden" name="scenario" value={scenario} />
          <SubmitButton>Créer l’espace de découverte</SubmitButton>
        </form>
        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-faint">
          Aucune connexion externe et aucun envoi ne sont activés par cette
          création.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BackButton onClick={() => setScreen("choice")} />
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-violet">
        Configuration · étape 1 sur 2
      </p>
      <h1 className="mt-2 text-xl font-semibold">Présentez votre entreprise</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Ces réponses donnent à Nepteo le contexte minimal. L’étape suivante
        proposera un enrichissement web en bêta, que vous pourrez passer.
      </p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="onboarding_path" value="real" />
        <div>
          <label htmlFor="name" className="block text-[13px] font-semibold text-ink">
            Nom de l’entreprise
          </label>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
            Utilisé pour nommer votre espace et contextualiser les propositions.
          </p>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            autoComplete="organization"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="activity" className="block text-[13px] font-semibold text-ink">
            Que vendez-vous, et à qui ?{" "}
            <span className="font-normal text-faint">(facultatif)</span>
          </label>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
            Sert à reconnaître vos offres, vos publics et les mots adaptés à
            votre activité.
          </p>
          <textarea
            id="activity"
            name="activity"
            rows={3}
            maxLength={300}
            placeholder="Exemple : nous installons des pompes à chaleur pour les propriétaires et les entreprises."
            className={FIELD}
          />
        </div>
        <div>
          <label
            htmlFor="philosophy"
            className="block text-[13px] font-semibold text-ink"
          >
            Vos principes de communication{" "}
            <span className="font-normal text-faint">(facultatif)</span>
          </label>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
            Votre façon de travailler, ce que vous promettez et ce que vous ne
            diriez jamais. Ces limites guideront les brouillons.
          </p>
          <textarea
            id="philosophy"
            name="philosophy"
            rows={4}
            maxLength={philosophyMax}
            placeholder="Exemple : je préfère refuser une mission plutôt que promettre un délai impossible."
            className={FIELD}
          />
        </div>
        {error && (
          <p className="rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] font-medium text-red">
            {error}
          </p>
        )}
        <SubmitButton>Continuer vers l’enrichissement web</SubmitButton>
      </form>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        Toutes les réponses resteront modifiables depuis Mon entreprise.
      </p>
    </div>
  );
}
