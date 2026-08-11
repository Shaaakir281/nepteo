import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingSubmitButton } from "./onboarding-submit-button";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";

export function OnboardingReal({
  action,
  error,
  onBack,
  philosophyMax,
}: {
  action: (formData: FormData) => Promise<void>;
  error?: string;
  onBack: () => void;
  philosophyMax: number;
}) {
  return (
    <div>
      <OnboardingBackButton onClick={onBack} />
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
        <OnboardingSubmitButton>
          Continuer vers l’enrichissement web
        </OnboardingSubmitButton>
      </form>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        Toutes les réponses resteront modifiables depuis Mon entreprise.
      </p>
    </div>
  );
}
