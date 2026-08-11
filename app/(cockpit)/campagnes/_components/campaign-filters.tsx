import type { CampaignCockpitFilters } from "./campaign-decision-types";

export const ALL_CAMPAIGN_FILTER = "__all__";

export function uniqueCampaignOptions(
  options: Array<{ id: string; label: string }>,
) {
  return Array.from(
    new Map(options.map((option) => [option.id, option])).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

export function CampaignFilters({
  filters,
  searchId,
  channelFilterId,
  statusFilterId,
  search,
  channel,
  status,
  onSearch,
  onServerFilter,
}: {
  filters: CampaignCockpitFilters;
  searchId: string;
  channelFilterId: string;
  statusFilterId: string;
  search: string;
  channel: string;
  status: string;
  onSearch: (value: string) => void;
  onServerFilter: (name: "channel" | "status", value: string) => void;
}) {
  const channelOptions = uniqueCampaignOptions(filters.channelOptions);
  const statusOptions = uniqueCampaignOptions(filters.statusOptions);
  if (channelOptions.length === 0 && statusOptions.length === 0) return null;

  return (
    <details className="rounded-[13px] border border-line-soft bg-white px-4">
      <summary className="cursor-pointer py-3 text-[12.5px] font-semibold text-ink">
        Filtrer les campagnes
      </summary>
      <div className="grid gap-3 border-t border-line-soft py-4 sm:grid-cols-3">
        <label htmlFor={searchId} className="text-[11px] font-semibold text-faint">
          Rechercher
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Nom de campagne"
            className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] text-body"
          />
        </label>
        {channelOptions.length > 0 && (
          <label htmlFor={channelFilterId} className="text-[11px] font-semibold text-faint">
            Canal observé
            <select
              id={channelFilterId}
              value={channel}
              onChange={(event) => onServerFilter("channel", event.target.value)}
              className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] text-body"
            >
              <option value={ALL_CAMPAIGN_FILTER}>Tous les canaux présents</option>
              {channelOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {statusOptions.length > 0 && (
          <label htmlFor={statusFilterId} className="text-[11px] font-semibold text-faint">
            État documenté
            <select
              id={statusFilterId}
              value={status}
              onChange={(event) => onServerFilter("status", event.target.value)}
              className="mt-1 block w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] text-body"
            >
              <option value={ALL_CAMPAIGN_FILTER}>Tous les états présents</option>
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </details>
  );
}
