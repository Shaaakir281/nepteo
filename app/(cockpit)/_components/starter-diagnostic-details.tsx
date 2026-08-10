import type { StarterDiagnostic } from "@/lib/diagnostic";
import { TodayDetails } from "./today-details";

export function StarterDiagnosticDetails({
  diagnostic,
}: {
  diagnostic: StarterDiagnostic;
}) {
  const otherChannels = diagnostic.channels.slice(1);

  return (
    <>
      <TodayDetails title="Plan de la semaine" count={diagnostic.firstWeek.length}>
        <ol className="space-y-1.5">
          {diagnostic.firstWeek.map((step) => (
            <li key={step} className="flex gap-2 text-[12.5px] leading-relaxed text-body">
              <span className="text-violet">→</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {diagnostic.avoid.length > 0 && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            <b>À éviter :</b> {diagnostic.avoid.join(" ")}
          </p>
        )}
      </TodayDetails>

      {otherChannels.map((channel) => (
        <TodayDetails key={channel.channel} title={channel.channel}>
          <p className="text-[12.5px] leading-relaxed text-body">
            {channel.firstStep}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {channel.why}
          </p>
          <p className="mt-2 text-[11.5px] text-faint">
            Effort {channel.effort.toLowerCase()} · {channel.cost}
          </p>
        </TodayDetails>
      ))}
    </>
  );
}
