import type { CampaignProspectSearch } from "./campaign-decision-types";

export function ProspectSearchPanel({
  search,
  presentation,
  inputId,
  channel,
  status,
  onClear,
}: {
  search: CampaignProspectSearch;
  presentation: string;
  inputId: string;
  channel: string | null;
  status: string | null;
  onClear: () => void;
}) {
  const problem = search.state === "invalid" || search.state === "unavailable";
  return (
    <section
      aria-labelledby="campaign-prospect-search-title"
      className="overflow-hidden rounded-[16px] border border-line-soft bg-white shadow-card"
    >
      <div className="border-b border-line-soft px-4 py-4 sm:px-5">
        <h3
          id="campaign-prospect-search-title"
          className="font-display text-[15px] font-semibold text-ink"
        >
          Prospects synchronisés
        </h3>
        <p className="mt-0.5 max-w-3xl text-[11.5px] leading-relaxed text-muted">
          Recherche en lecture seule par nom ou société. Seuls le nom, la
          société, la source et la date de synchronisation sont relus ; aucun
          email, contenu brut ou note interne n&apos;est sélectionné.
        </p>
        <p className="mt-1 text-[10.5px] font-semibold text-violet">
          Origine présentée : {presentation}
        </p>
        <form
          role="search"
          action="/campagnes"
          method="get"
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          {channel && <input type="hidden" name="channel" value={channel} />}
          {status && <input type="hidden" name="status" value={status} />}
          <label
            htmlFor={inputId}
            className="min-w-0 flex-1 text-[11px] font-semibold text-faint"
          >
            Nom ou société
            <input
              key={search.query}
              id={inputId}
              name="prospect"
              type="search"
              defaultValue={search.query}
              minLength={2}
              maxLength={80}
              autoComplete="off"
              placeholder="Ex. Dupont ou Atelier Nova"
              className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-body transition-colors focus:border-violet motion-reduce:transition-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-[9px] bg-violet px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-violet-deep motion-reduce:transition-none"
            >
              Rechercher
            </button>
            {search.query && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-[9px] border border-line px-3.5 py-2 text-[12px] font-semibold text-body transition hover:bg-tint-soft motion-reduce:transition-none"
              >
                Effacer
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="px-4 py-3.5 sm:px-5">
        <p
          role={problem ? "alert" : "status"}
          aria-live="polite"
          className={`text-[11.5px] leading-relaxed ${
            problem ? "text-amber" : "text-muted"
          }`}
        >
          {search.message}
        </p>
        {search.state === "ready" && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {search.results.map((prospect) => (
              <li
                key={prospect.id}
                className="min-w-0 rounded-[11px] border border-line-soft bg-tint-soft/35 px-3.5 py-3"
              >
                <p className="break-words text-[12.5px] font-semibold text-ink">
                  {prospect.name}
                </p>
                {prospect.company && (
                  <p className="mt-0.5 break-words text-[11.5px] text-body">
                    {prospect.company}
                  </p>
                )}
                <p className="mt-1.5 break-words text-[10.5px] leading-relaxed text-faint">
                  Source enregistrée : {prospect.source} · synchronisé le {" "}
                  {prospect.syncedAtLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
