"use client";

import { useState } from "react";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { FIELD } from "@/components/ui/styles";
import type { IdentityProposal } from "@/lib/research/profile-rules";
import type { ResearchSource } from "@/lib/research/research-rules";
import { applyIdentity, proposeIdentity, skipIdentity } from "../actions";

/**
 * Assistant d'identité : coller une adresse → l'agent cherche → il PROPOSE,
 * l'utilisateur corrige et valide. Autonomie visible (étapes cadencées pendant
 * la recherche réelle) et honnêteté (sources citées, manques assumés).
 */

const STEPS = [
  "Lecture de votre site…",
  "Recherche de sources publiques…",
  "Mise en forme de votre identité…",
];
const STEP_MS = 1200;

const REASONS: Record<string, string> = {
  no_key: "La recherche web n'est pas encore configurée sur ce compte.",
  paused: "L'agent est en pause. Réactivez-le depuis « Agent & garde-fous ».",
  daily_cap: "Vous avez atteint la limite de recherches du jour.",
  invalid_url: "Cette adresse ne semble pas valide.",
  no_subject: "Cette adresse ne semble pas valide.",
  nothing_found: "Je n'ai rien trouvé d'exploitable sur cette adresse.",
  empty_answer: "Je n'ai rien trouvé d'exploitable sur cette adresse.",
  timeout:
    "La recherche n'a pas abouti dans le délai maximal. Aucun nouvel essai automatique n'a été lancé.",
  demo_active:
    "Retirez d'abord le scénario Nepteo avant d'analyser un site.",
  busy: "Une autre opération est en cours. Réessayez dans un instant.",
};

function reasonLabel(reason: string): string {
  return REASONS[reason] ?? "La recherche n'a pas abouti. Réessayez dans un instant.";
}

export function IdentityWizard({
  activityOptions,
  audienceOptions,
  channelOptions,
}: {
  activityOptions: string[];
  audienceOptions: string[];
  channelOptions: string[];
}) {
  const [website, setWebsite] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<IdentityProposal | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);

  async function run() {
    if (running || !website.trim()) return;
    setRunning(true);
    setError(null);
    setStep(0);

    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + 1, STEPS.length - 1);
      setStep(current);
    }, STEP_MS);
    const minDelay = new Promise((r) => setTimeout(r, STEPS.length * STEP_MS));

    try {
      const [result] = await Promise.all([proposeIdentity(website), minDelay]);
      if (result.ok) {
        setProposal(result.proposal);
        setSources(result.sources);
      } else {
        setError(reasonLabel(result.reason));
      }
    } catch {
      setError("La recherche n'a pas abouti. Réessayez dans un instant.");
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  }

  // ===== Étape 1 : l'adresse =====
  if (!proposal) {
    return (
      <>
        <h1 className="text-xl font-semibold">
          Laissez-moi découvrir votre entreprise
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Donnez-moi l&apos;adresse de votre site : je le lis et je vous propose
          une fiche à corriger. Plus rapide que de tout saisir.
        </p>

        <div className="mt-6">
          <label htmlFor="website" className="block text-[13px] font-semibold text-ink">
            Adresse de votre site
          </label>
          <input
            id="website"
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            placeholder="monentreprise.fr"
            disabled={running}
            className={`mt-1 ${FIELD}`}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] font-medium text-red">
            {error}
          </p>
        )}

        {running ? (
          <div className="mt-5 flex items-center gap-2.5 text-[13px] font-medium text-violet">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet border-t-transparent" />
            <span>{STEPS[step]}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={!website.trim()}
            className="mt-5 w-full rounded-[10px] bg-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyser mon site
          </button>
        )}

        <form action={skipIdentity} className="mt-3 text-center">
          <button
            type="submit"
            disabled={running}
            className="text-[12.5px] font-semibold text-muted hover:text-ink hover:underline"
          >
            Passer cette étape
          </button>
        </form>
      </>
    );
  }

  // ===== Étape 2 : la proposition, corrigeable =====
  return (
    <form action={applyIdentity}>
      <h1 className="text-xl font-semibold">Voici ce que j&apos;ai compris</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Corrigez ce qui est faux — c&apos;est votre version qui sera enregistrée.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">
            Que propose votre entreprise ?
          </p>
          <ChipGroup>
            {activityOptions.map((o) => (
              <Chip
                key={o}
                type="radio"
                name="activity_type"
                value={o}
                defaultChecked={proposal.activity_type === o}
              />
            ))}
          </ChipGroup>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">
            À qui vendez-vous principalement ?
          </p>
          <ChipGroup>
            {audienceOptions.map((o) => (
              <Chip
                key={o}
                type="radio"
                name="audience"
                value={o}
                defaultChecked={proposal.audience === o}
              />
            ))}
          </ChipGroup>
        </div>

        <div>
          <label htmlFor="description" className="block text-[12px] font-semibold text-ink">
            Votre activité, en quelques mots
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={1000}
            defaultValue={proposal.description ?? ""}
            className={`mt-1 ${FIELD}`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="zone" className="block text-[12px] font-semibold text-ink">
              Zone
            </label>
            <input
              id="zone"
              name="zone"
              maxLength={200}
              defaultValue={proposal.zone ?? ""}
              className={`mt-1 ${FIELD}`}
            />
          </div>
          <div>
            <label htmlFor="ton" className="block text-[12px] font-semibold text-ink">
              Ton
            </label>
            <input
              id="ton"
              name="ton"
              maxLength={500}
              defaultValue={proposal.ton ?? ""}
              className={`mt-1 ${FIELD}`}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">
            Comment vos clients vous trouvent
          </p>
          <ChipGroup>
            {channelOptions.map((c) => (
              <Chip
                key={c}
                type="checkbox"
                name="canaux"
                value={c}
                defaultChecked={proposal.canaux.includes(c)}
              />
            ))}
          </ChipGroup>
        </div>

        {proposal.offres.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-semibold text-ink">
              Offres repérées
            </p>
            <ul className="space-y-1.5">
              {proposal.offres.map((o, i) => (
                <li
                  key={`${o.name}-${i}`}
                  className="rounded-[10px] border border-line-soft bg-tint-soft px-3.5 py-2 text-[13px] text-ink"
                >
                  <b>{o.name}</b>
                  {o.price ? ` — ${o.price}` : ""}
                  {o.promise ? (
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {o.promise}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <input type="hidden" name="offres" value={JSON.stringify(proposal.offres)} />
            <p className="mt-1.5 text-[11.5px] text-faint">
              Vous pourrez les détailler ou les supprimer depuis la vue Entreprise.
            </p>
          </div>
        )}

        {proposal.presence.length > 0 && (
          <div>
            <p className="mb-1 text-[12px] font-semibold text-ink">
              Ce que vous faites déjà, vu de l&apos;extérieur
            </p>
            <p className="mb-2 text-[11.5px] leading-relaxed text-muted">
              Décochez ce qui est faux. L&apos;agent en tiendra compte pour ne
              pas vous proposer ce que vous faites déjà.
            </p>
            <div className="space-y-1.5">
              {proposal.presence.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-soft bg-tint-soft/50 px-3.5 py-2 text-[12.5px] leading-relaxed text-ink has-[:checked]:border-violet has-[:checked]:bg-tint-soft"
                >
                  <input
                    type="checkbox"
                    name="presence"
                    value={p}
                    defaultChecked
                    className="mt-[3px] flex-none accent-violet"
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {proposal.gaps.length > 0 && (
          <div className="rounded-[10px] border border-line-soft bg-tint-soft px-3.5 py-3">
            <p className="text-[12px] font-semibold text-ink">
              Ce que je n&apos;ai pas trouvé
            </p>
            <ul className="mt-1 list-inside list-disc text-[12px] leading-relaxed text-muted">
              {proposal.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {sources.length > 0 && (
          <div>
            <p className="text-[11.5px] font-semibold text-faint">Sources consultées</p>
            <ul className="mt-1 space-y-0.5">
              {sources.map((s) => (
                <li key={s.url} className="truncate text-[11.5px]">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="mt-6 w-full rounded-[10px] bg-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
      >
        C&apos;est juste, enregistrer
      </button>
      <button
        type="button"
        onClick={() => {
          setProposal(null);
          setSources([]);
        }}
        className="mt-3 w-full text-[12.5px] font-semibold text-muted hover:text-ink hover:underline"
      >
        Recommencer avec une autre adresse
      </button>
    </form>
  );
}
