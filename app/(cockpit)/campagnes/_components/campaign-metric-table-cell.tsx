import type { CampaignMetricCell } from "./campaign-decision-types";
import { EvidenceReference, toneTextClass } from "./campaign-evidence";

export function MetricTableCell({
  metric,
  emphasize = false,
}: {
  metric: CampaignMetricCell;
  emphasize?: boolean;
}) {
  const observation = metric.observation;
  return (
    <td className="px-3 py-3 text-right">
      {observation.state === "available" ? (
        <>
          <p
            className={`tabular-nums ${
              emphasize ? "font-semibold text-ink" : "text-body"
            }`}
          >
            {observation.value}
          </p>
          {observation.comparison && (
            <p
              className={`mt-0.5 text-[9.5px] font-medium tabular-nums ${toneTextClass(
                observation.comparison.tone,
              )}`}
            >
              {observation.comparison.value}
            </p>
          )}
          <p className="mt-0.5 text-[9.5px] text-faint">{metric.label}</p>
          <EvidenceReference
            source={observation.source}
            className="mt-0.5 text-right"
          />
        </>
      ) : (
        <div className="ml-auto max-w-[180px]">
          <p className="text-[10.5px] font-medium text-muted">
            {observation.state === "insufficient"
              ? "Insuffisant"
              : "Indisponible"}
          </p>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-faint">
            {observation.reason}
          </p>
          {observation.source && (
            <EvidenceReference
              source={observation.source}
              className="mt-0.5 text-right"
            />
          )}
        </div>
      )}
    </td>
  );
}
