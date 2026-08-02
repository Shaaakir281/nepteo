import type { IdentityProposal } from "@/lib/research/profile-rules";
import type { ResearchQuotaStatus } from "@/lib/research/research";
import type { ResearchSource } from "@/lib/research/research-rules";
import type { WebsitePreviewCurrentProfile } from "@/lib/research/website-preview-apply-rules";
import { WebsitePreviewApplication } from "./website-preview-application";

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[13px] border border-line-soft bg-tint-soft px-4 py-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-2 text-[13px] leading-relaxed text-body">{children}</div>
    </section>
  );
}

export function WebsitePreviewResult({
  result,
  onRefresh,
  currentProfile,
  applicationBlocked,
  applicationContextAvailable,
}: {
  result: {
    url: string;
    hostname: string;
    proposal: IdentityProposal;
    sources: ResearchSource[];
    cached: boolean;
    quota: ResearchQuotaStatus;
  };
  onRefresh: () => void;
  currentProfile: WebsitePreviewCurrentProfile;
  applicationBlocked: boolean;
  applicationContextAvailable: boolean;
}) {
  const p = result.proposal;
  return (
    <article className="rounded-[18px] border border-line-soft bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[16px] font-semibold">{result.hostname}</h2>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${result.cached ? "bg-tint text-violet-ink" : "bg-green-tint text-green"}`}>
              {result.cached ? "Cache réutilisé — aucun nouvel appel" : "Nouvelle analyse"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted">
            Quota : {result.quota.used}/{result.quota.limit} utilisé · {result.quota.remaining} restant
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-[10px] border border-line px-3.5 py-2 text-[12px] font-semibold text-body hover:bg-tint-soft"
        >
          Actualiser l&apos;analyse
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ResultSection title="Offres & positionnement">
          {p.activity_type && <p className="font-semibold text-ink">{p.activity_type}</p>}
          {p.description && <p className="mt-1">{p.description}</p>}
          {p.offres.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {p.offres.map((offer, index) => (
                <li key={`${offer.name}-${index}`}>
                  <b className="text-ink">{offer.name}</b>
                  {offer.price ? ` — ${offer.price}` : ""}
                  {offer.target ? <span className="block text-[12px] text-muted">Cible : {offer.target}</span> : null}
                  {offer.promise ? <span className="block text-[12px] text-muted">{offer.promise}</span> : null}
                </li>
              ))}
            </ul>
          ) : !p.description && !p.activity_type ? <p>Non établi.</p> : null}
        </ResultSection>

        <ResultSection title="Audience & territoire">
          {p.audience ? <p><b className="text-ink">Audience :</b> {p.audience}</p> : null}
          {p.zone ? <p className="mt-1"><b className="text-ink">Territoire :</b> {p.zone}</p> : null}
          {!p.audience && !p.zone && <p>Non établi.</p>}
        </ResultSection>

        <ResultSection title="Ton & preuves">
          {p.ton ? <p><b className="text-ink">Ton :</b> {p.ton}</p> : null}
          {p.canaux.length > 0 ? <p className="mt-1"><b className="text-ink">Canaux :</b> {p.canaux.join(", ")}</p> : null}
          {p.presence.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {p.presence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : !p.ton && p.canaux.length === 0 ? <p>Non établi.</p> : null}
        </ResultSection>

        <ResultSection title="Manques assumés">
          {p.gaps.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4">
              {p.gaps.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
          ) : <p>Aucun manque explicite n&apos;a été renvoyé ; cela ne garantit pas que la fiche soit complète.</p>}
        </ResultSection>
      </div>

      <section className="mt-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Sources</h3>
        {result.sources.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-[12.5px]">
            {result.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-violet hover:underline">
                  {source.title}
                </a>
                {source.date ? <span className="ml-2 text-faint">{source.date}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[12.5px] text-muted">Aucune source cliquable n&apos;a été renvoyée.</p>}
      </section>

      <p className="mt-4 rounded-[10px] bg-tint px-3.5 py-2.5 text-[12px] leading-relaxed text-body">
        Cette analyse reste séparée de votre fiche tant que vous n&apos;avez pas relu, coché et confirmé des sections ci-dessous.
      </p>

      <WebsitePreviewApplication
        website={result.url}
        proposal={p}
        currentProfile={currentProfile}
        applicationBlocked={applicationBlocked}
        applicationContextAvailable={applicationContextAvailable}
      />
    </article>
  );
}
