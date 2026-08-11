import type { CampaignMetricCell } from "./campaign-decision-types";
import { EvidenceReference, toneTextClass } from "./campaign-evidence";

export function MetricDefinition({ metric }: { metric: CampaignMetricCell }) {
  const observation = metric.observation;
  return (
    <div>
      <dt className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-faint">
        {metric.label}
      </dt>
      <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-body">
        {observation.state === "available"
          ? observation.value
          : observation.state === "insufficient"
            ? "Insuffisant"
            : "Indisponible"}
      </dd>
      {observation.state === "available" && (
        <>
          {observation.comparison && (
            <p
              className={`mt-0.5 text-[9.5px] font-medium tabular-nums ${toneTextClass(
                observation.comparison.tone,
              )}`}
            >
              {observation.comparison.value}
            </p>
          )}
          <EvidenceReference source={observation.source} className="mt-0.5" />
        </>
      )}
      {observation.state !== "available" && (
        <>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">
            {observation.reason}
          </p>
          {observation.source && (
            <EvidenceReference source={observation.source} className="mt-0.5" />
          )}
        </>
      )}
    </div>
  );
}
