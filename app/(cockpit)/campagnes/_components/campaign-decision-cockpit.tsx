"use client";

import { useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CampaignActivityList } from "./campaign-activity-list";
import { CampaignAttemptHistory } from "./campaign-attempt-history";
import { CreativeAuditUnavailable } from "./campaign-creative-audit";
import { CampaignDecisionDetails } from "./campaign-decision-details";
import { CampaignDecisionHero } from "./campaign-decision-hero";
import type { CampaignDecisionCockpitProps } from "./campaign-decision-types";
import {
  ALL_CAMPAIGN_FILTER,
  CampaignFilters,
  uniqueCampaignOptions,
} from "./campaign-filters";
import { CampaignMeasuredList } from "./campaign-measured-list";
import { WeeklyInsightsPanel } from "./campaign-weekly-insights";
import type { CampaignBriefDefaults } from "@/lib/campaign-brief-defaults";

export * from "./campaign-decision-types";

type CampaignTab = "decision" | "report" | "history";

export function CampaignDecisionCockpit(
  props: CampaignDecisionCockpitProps & {
    campaignBriefDefaults: CampaignBriefDefaults;
  },
) {
  const [tab, setTab] = useState<CampaignTab>("decision");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();
  const channelFilterId = useId();
  const statusFilterId = useId();
  const prospectSearchId = useId();

  const channels = useMemo(
    () => uniqueCampaignOptions(props.filters.channelOptions),
    [props.filters.channelOptions],
  );
  const statuses = useMemo(
    () => uniqueCampaignOptions(props.filters.statusOptions),
    [props.filters.statusOptions],
  );
  const channel = channels.some((option) => option.id === props.filters.channel)
    ? props.filters.channel
    : ALL_CAMPAIGN_FILTER;
  const status = statuses.some((option) => option.id === props.filters.status)
    ? props.filters.status
    : ALL_CAMPAIGN_FILTER;
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const matchesSearch = (...values: string[]) =>
    normalizedSearch === "" ||
    values.some((value) =>
      value.toLocaleLowerCase("fr").includes(normalizedSearch),
    );
  const visibleCampaigns = props.campaigns.filter(
    (campaign) =>
      (channel === ALL_CAMPAIGN_FILTER || campaign.channel.id === channel) &&
      (status === ALL_CAMPAIGN_FILTER || campaign.status.id === status) &&
      matchesSearch(campaign.name, campaign.channel.label, campaign.status.label),
  );
  const visibleAttempts = props.pastAttempts.filter(
    (attempt) =>
      (channel === ALL_CAMPAIGN_FILTER || attempt.channel.id === channel) &&
      matchesSearch(attempt.name, attempt.channel.label, attempt.outcome),
  );
  const hasMeasuredData = props.campaigns.length > 0 || props.kpis.some(
    (kpi) => kpi.observation.state === "available",
  );

  const updateServerFilter = (name: "channel" | "status", value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("proposed");
    if (value === ALL_CAMPAIGN_FILTER) next.delete(name);
    else next.set(name, value);
    const query = next.toString();
    router.replace(query ? `?${query}` : "/campagnes", { scroll: false });
  };
  const clearProspectSearch = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("prospect");
    next.delete("proposed");
    const query = next.toString();
    router.replace(query ? `?${query}` : "/campagnes", { scroll: false });
  };

  return (
    <section aria-label="Cockpit Campagnes">
      <div role="tablist" aria-label="Sections Campagnes" className="mb-5 flex gap-1 border-b border-line-soft">
        {([
          ["decision", "Décision"],
          ["report", "Rapport"],
          ["history", "Historique"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`border-b-2 px-3 py-2 text-[13px] font-semibold transition ${
              tab === id
                ? "border-violet text-violet"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "decision" && (
        <div role="tabpanel">
          <CampaignDecisionHero
            canEdit={props.canEdit}
            dataState={props.dataState}
            period={props.period}
            kpis={props.kpis}
            recommendation={props.recommendation}
            dailySummary={props.dailySummary?.text ?? null}
            hasMeasuredData={hasMeasuredData}
            campaignBriefDefaults={props.campaignBriefDefaults}
          />
          <CampaignDecisionDetails
            operationalSummary={props.operationalSummary}
            prospectSearch={props.prospectSearch}
            prospectPresentation={props.prospectPresentation}
            prospectSearchId={prospectSearchId}
            channel={channel === ALL_CAMPAIGN_FILTER ? null : channel}
            status={status === ALL_CAMPAIGN_FILTER ? null : status}
            deliveryDiagnostic={props.deliveryDiagnostic}
            onClearProspectSearch={clearProspectSearch}
          />
        </div>
      )}

      {tab === "report" && (
        <div role="tabpanel" className="space-y-3">
          <WeeklyInsightsPanel insights={props.weeklyInsights} />
          <CreativeAuditUnavailable />
        </div>
      )}

      {tab === "history" && (
        <div role="tabpanel" className="space-y-4">
          <CampaignFilters
            filters={props.filters}
            searchId={searchId}
            channelFilterId={channelFilterId}
            statusFilterId={statusFilterId}
            search={search}
            channel={channel}
            status={status}
            onSearch={setSearch}
            onServerFilter={updateServerFilter}
          />
          <CampaignMeasuredList
            campaigns={props.campaigns}
            visibleCampaigns={visibleCampaigns}
          />
          <CampaignAttemptHistory
            attempts={props.pastAttempts}
            visibleAttempts={visibleAttempts}
          />
          <CampaignActivityList activity={props.activity} />
        </div>
      )}
    </section>
  );
}
