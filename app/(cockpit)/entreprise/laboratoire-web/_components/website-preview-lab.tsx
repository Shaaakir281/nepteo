"use client";

import { useState, type FormEvent } from "react";
import { FIELD } from "@/components/ui/styles";
import type { ResearchQuotaStatus } from "@/lib/research/research";
import type { WebsitePreviewCurrentProfile } from "@/lib/research/website-preview-apply-rules";
import { validatePublicWebsite } from "@/lib/research/website-preview-rules";
import { runWebsitePreviewAction } from "../actions";
import { WebsitePreviewResult } from "./website-preview-result";

type ActionResult = Awaited<ReturnType<typeof runWebsitePreviewAction>>;
type SuccessResult = Extract<ActionResult, { ok: true }>;

const ERRORS: Record<string, string> = {
  empty_url: "Indiquez l'adresse d'un site public.",
  invalid_url: "Cette adresse ne semble pas valide.",
  unsupported_protocol: "Utilisez uniquement une adresse HTTP ou HTTPS.",
  credentials_not_allowed: "Une adresse contenant des identifiants est refusée.",
  non_standard_port: "Utilisez l'adresse publique standard du site, sans port spécifique.",
  public_hostname_required: "Indiquez un nom de domaine public, pas une adresse locale ou une IP.",
  no_key: "La recherche web n'est pas configurée sur ce compte.",
  paused: "L'agent est en pause. Réactivez-le depuis l'onglet Agent.",
  daily_cap: "La limite quotidienne de recherches est atteinte.",
  quota_unavailable: "Le quota ne peut pas être vérifié : aucune analyse n'a été lancée.",
  cache_unavailable: "Le cache est indisponible : aucune analyse n'a été lancée.",
  journal_unavailable: "Le journal est indisponible : aucun appel externe n'a été lancé.",
  retention_unavailable: "La rétention ne peut pas être garantie : aucune analyse n'a été lancée.",
  empty_answer: "Le fournisseur n'a renvoyé aucun résultat exploitable.",
  nothing_found: "Aucun résultat structuré et suffisamment fiable n'a été trouvé.",
  timeout: "La recherche n'a pas abouti dans le délai maximal. Aucun nouvel essai automatique n'a été lancé.",
  network_error: "La recherche a rencontré une erreur réseau. Aucun nouvel essai automatique n'a été lancé.",
  forbidden: "Votre rôle ne permet pas de lancer une analyse.",
  confirmation_required: "Confirmez explicitement l'analyse avant de la lancer.",
  force_confirmation_required: "Confirmez explicitement l'actualisation sans cache.",
};

function errorLabel(reason: string): string {
  if (reason.startsWith("http_")) {
    return `Le fournisseur a refusé la recherche (${reason.replace("http_", "HTTP ")}). Aucun nouvel essai automatique n'a été lancé.`;
  }
  return ERRORS[reason] ?? "La recherche n'a pas abouti. Aucun nouvel essai automatique n'a été lancé.";
}

export function WebsitePreviewLab({
  canEdit,
  researchEnabled,
  initialQuota,
  currentProfile,
  applicationBlocked,
  applicationContextAvailable,
}: {
  canEdit: boolean;
  researchEnabled: boolean;
  initialQuota: ResearchQuotaStatus | null;
  currentProfile: WebsitePreviewCurrentProfile;
  applicationBlocked: boolean;
  applicationContextAvailable: boolean;
}) {
  const [website, setWebsite] = useState("");
  const [quota, setQuota] = useState(initialQuota);
  const [pending, setPending] = useState<{
    website: string;
    hostname: string;
    force: boolean;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [resultRevision, setResultRevision] = useState(0);

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validatePublicWebsite(website);
    if (!checked.ok) {
      setError(errorLabel(checked.reason));
      setPending(null);
      return;
    }
    setWebsite(checked.url);
    setError(null);
    setPending({ website: checked.url, hostname: checked.hostname, force: false });
  }

  async function confirm() {
    if (!pending || running || !quota) return;
    setRunning(true);
    setError(null);
    try {
      const response = await runWebsitePreviewAction({
        website: pending.website,
        confirmed: true,
        force: pending.force,
        forceConfirmed: pending.force,
      });
      if ("quota" in response && response.quota) setQuota(response.quota);
      if (response.ok) {
        setResult(response);
        setResultRevision((revision) => revision + 1);
        setWebsite(response.url);
        setPending(null);
      } else {
        setError(errorLabel(response.reason));
      }
    } catch {
      setError("La demande n'a pas abouti. Aucun nouvel essai automatique n'a été lancé.");
    } finally {
      setRunning(false);
    }
  }

  if (!canEdit) {
    return (
      <p className="mt-5 rounded-[13px] bg-tint-soft px-4 py-3 text-[13px] text-muted">
        Lecture seule — votre rôle ne permet pas de lancer une analyse web.
      </p>
    );
  }

  if (!researchEnabled) {
    return (
      <p className="mt-5 rounded-[13px] bg-amber-tint px-4 py-3 text-[13px] text-body">
        La recherche web n&apos;est pas configurée sur ce compte. Aucun appel ne
        peut être lancé.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[18px] border border-line-soft bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px] font-semibold">Site à étudier</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Les adresses locales, IP brutes, identifiants et ports spécifiques sont refusés.
            </p>
          </div>
          <span className="rounded-full bg-tint px-3 py-1 text-[11.5px] font-semibold text-violet-ink">
            {quota
              ? `${quota.used} analyses lancées aujourd'hui · sans limite`
              : "Compteur indisponible"}
          </span>
        </div>

        <form onSubmit={prepare} className="mt-4 flex gap-2 max-sm:flex-col">
          <label htmlFor="website-preview" className="sr-only">Adresse du site public</label>
          <input
            id="website-preview"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://entreprise.fr"
            disabled={running}
            className={FIELD}
          />
          <button
            type="submit"
            disabled={running || !website.trim()}
            className="flex-none rounded-[10px] bg-violet px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            Préparer l&apos;analyse
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[12.5px] font-medium text-red">
            {error}
          </p>
        )}

        {pending && (
          <div className="mt-4 rounded-[13px] border border-amber/30 bg-amber-tint px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">
              Confirmer l&apos;analyse de {pending.hostname}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-body">
              {pending.force
                ? "Cette actualisation ignore le cache et journalise un nouvel appel."
                : "Un résultat frais sera réutilisé sans coût. Sinon, Nepteo journalisera un nouvel appel avant de contacter le fournisseur."}
              {" "}Une requête OpenAI peut contenir plusieurs recherches web facturées ; leur nombre sera journalisé.
            </p>
            {!quota && (
              <p className="mt-2 text-[12px] font-semibold text-red">
                Impossible de confirmer tant que le compteur d&apos;usage n&apos;est pas lisible.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={running || !quota}
                className="rounded-[10px] bg-violet px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? "Analyse en cours…" : pending.force ? "Confirmer l'actualisation" : "Confirmer et lancer"}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={running}
                className="rounded-[10px] border border-line bg-white px-4 py-2 text-[12.5px] font-semibold text-body hover:bg-tint-soft disabled:opacity-40"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <WebsitePreviewResult
          key={resultRevision}
          result={result}
          currentProfile={currentProfile}
          applicationBlocked={applicationBlocked}
          applicationContextAvailable={applicationContextAvailable}
          onRefresh={() => {
            setError(null);
            setPending({ website: result.url, hostname: result.hostname, force: true });
          }}
        />
      )}
    </div>
  );
}
