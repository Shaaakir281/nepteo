import type { ReactNode } from "react";
import type {
  CampaignAgentReading,
  CampaignDecisionStatus,
  CampaignEvidenceReference,
  CampaignStatusEvidence,
  CampaignTone,
} from "./campaign-decision-types";

export function StatusBadge({ status }: { status: CampaignDecisionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${toneBadgeClass(
        status.tone,
      )}`}
    >
      {status.label}
    </span>
  );
}
export function StatusEvidence({ evidence }: { evidence: CampaignStatusEvidence }) {
  return evidence.kind === "observed" ? (
    <EvidenceReference source={evidence.source} className="mt-1.5" prefix="État" />
  ) : (
    <div className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
      <p>État dérivé · {evidence.rule}</p>
      {evidence.source && <EvidenceReference source={evidence.source} />}
    </div>
  );
}

export function ReadingEvidence({
  reading,
  prominent = false,
}: {
  reading: CampaignAgentReading;
  prominent?: boolean;
}) {
  const confidence = reading.confidence;
  return (
    <div
      className={
        prominent
          ? "rounded-[11px] border border-violet/15 bg-white/70 px-3 py-2.5"
          : "mt-2"
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
            confidence.state === "calculated"
              ? confidenceBadgeClass(confidence.level)
              : "bg-tint-soft text-muted"
          }`}
        >
          {confidence.state === "calculated"
            ? `Confiance ${confidenceLabel(confidence.level)}`
            : "Confiance non calculée"}
        </span>
        {!reading.source && (
          <span className="rounded-full bg-red-tint px-2 py-0.5 text-[9.5px] font-semibold text-red">
            Source manquante
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">
        {confidence.reason}
      </p>
      {reading.source ? (
        <EvidenceReference source={reading.source} className="mt-1" />
      ) : (
        <p className="mt-1 text-[10px] leading-relaxed text-red">
          Cette lecture ne doit pas être utilisée comme preuve.
        </p>
      )}
    </div>
  );
}

export function EvidenceReference({
  source,
  className = "",
  prefix = "Source",
}: {
  source: CampaignEvidenceReference;
  className?: string;
  prefix?: string;
}) {
  return (
    <p className={`text-[9.5px] leading-relaxed text-faint ${className}`}>
      {prefix} : {source.label}
      {source.periodLabel ? ` · ${source.periodLabel}` : ""}
      {source.observedAtLabel ? ` · relevé ${source.observedAtLabel}` : ""}
    </p>
  );
}

export function InlineEmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-[11px] border border-dashed border-line bg-tint-soft/50 px-4 py-5 text-center text-[11.5px] leading-relaxed text-muted"
    >
      {children}
    </div>
  );
}

function confidenceLabel(level: "high" | "medium" | "low") {
  if (level === "high") return "élevée";
  if (level === "medium") return "moyenne";
  return "faible";
}

function confidenceBadgeClass(level: "high" | "medium" | "low") {
  if (level === "high") return "bg-green-tint text-green";
  if (level === "medium") return "bg-amber-tint text-amber";
  return "bg-red-tint text-red";
}

function toneBadgeClass(tone: CampaignTone) {
  if (tone === "positive") return "bg-green-tint text-green";
  if (tone === "warning") return "bg-amber-tint text-amber";
  if (tone === "negative") return "bg-red-tint text-red";
  return "bg-tint-soft text-body";
}

export function toneTextClass(tone: CampaignTone | undefined) {
  if (tone === "positive") return "text-green";
  if (tone === "warning") return "text-amber";
  if (tone === "negative") return "text-red";
  return "text-muted";
}
