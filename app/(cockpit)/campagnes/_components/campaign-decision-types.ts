import type { CampaignAnalyticQuestionId } from "@/lib/campaign-insights";

export type CampaignTone = "neutral" | "positive" | "warning" | "negative";

export interface CampaignEvidenceReference {
  label: string;
  periodLabel?: string;
  observedAtLabel?: string;
}

export interface CampaignDecisionPeriod {
  label: string;
  startLabel: string;
  endLabel: string;
  comparison:
    | {
        label: string;
        startLabel: string;
        endLabel: string;
      }
    | null;
  comparisonUnavailableReason?: string;
}

export type CampaignCockpitDataState =
  | { kind: "ready" }
  | {
      kind: "empty";
      code?: "empty_filter_result";
      description: string;
    }
  | { kind: "insufficient"; description: string };

export type CampaignObservedValue =
  | {
      state: "available";
      value: string;
      source: CampaignEvidenceReference;
      comparison?: {
        value: string;
        tone?: CampaignTone;
      } | null;
    }
  | {
      state: "insufficient" | "unavailable";
      reason: string;
      source?: CampaignEvidenceReference | null;
    };

export interface CampaignObservedKpi {
  id: string;
  label: string;
  observation: CampaignObservedValue;
}

export type CampaignConfidence =
  | {
      state: "calculated";
      level: "high" | "medium" | "low";
      reason: string;
    }
  | {
      state: "not_calculated";
      reason: string;
    };

export interface CampaignAgentReading {
  summary: string;
  source: CampaignEvidenceReference | null;
  confidence: CampaignConfidence;
}

export interface CampaignDeliveryReading {
  state: "available" | "unavailable";
  summary: string;
  disclaimer: string;
  source: CampaignEvidenceReference | null;
  confidence: CampaignConfidence;
}

export interface CampaignPriorityRecommendation extends CampaignAgentReading {
  title: string;
}

export type CampaignStatusEvidence =
  | {
      kind: "observed";
      source: CampaignEvidenceReference;
    }
  | {
      kind: "derived";
      rule: string;
      source?: CampaignEvidenceReference | null;
    };

export interface CampaignDecisionStatus {
  id: string;
  label: string;
  tone: CampaignTone;
  /**
   * « Active », « terminée », « en attente » ou « bloquée » exigent une
   * preuve observée. Une classification par date seule doit rester dérivée et
   * porter un libellé de récence (par exemple « Données récentes »).
   */
  evidence: CampaignStatusEvidence;
}

export interface CampaignMetricCell {
  label: string;
  observation: CampaignObservedValue;
}

export interface CampaignDecisionRow {
  id: string;
  name: string;
  channel: {
    id: string;
    label: string;
  };
  status: CampaignDecisionStatus;
  source: CampaignEvidenceReference | null;
  spend: CampaignMetricCell;
  acquisitionCost: CampaignMetricCell;
  results: CampaignMetricCell;
  revenue: CampaignMetricCell;
  roas: CampaignMetricCell;
  cpm: CampaignMetricCell;
  ctr: CampaignMetricCell;
  deliveryDiagnostic: CampaignDeliveryReading;
  agentReading: CampaignAgentReading | null;
}

export interface CampaignPastAttempt {
  id: string;
  name: string;
  channel: {
    id: string;
    label: string;
  };
  periodLabel: string;
  outcome: string;
  learning: string | null;
  source: CampaignEvidenceReference;
}

export interface CampaignDailySummary {
  text: string;
  source: CampaignEvidenceReference;
}

export interface CampaignActivityEvent {
  id: string;
  title: string;
  detail: string;
  atLabel: string;
  source: CampaignEvidenceReference;
}

export interface CampaignCockpitFilters {
  channel: string;
  status: string;
  channelOptions: Array<{ id: string; label: string }>;
  statusOptions: Array<{ id: string; label: string }>;
}

export interface CampaignOperationalFact {
  state: "available" | "unavailable";
  label: string;
  value: string;
  detail: string;
}

export interface CampaignOperationalSummary {
  agent: CampaignOperationalFact;
  connectors: CampaignOperationalFact;
  lastAnalysis: CampaignOperationalFact;
}

export interface CampaignProspectSearchResult {
  id: string;
  name: string;
  company: string | null;
  source: string;
  syncedAtLabel: string;
}

export interface CampaignProspectSearch {
  state: "idle" | "ready" | "empty" | "invalid" | "unavailable";
  query: string;
  message: string;
  results: CampaignProspectSearchResult[];
}

export interface CampaignWeeklyMetricView {
  id: string;
  label: string;
  current: string;
  previous: string;
  change: string;
}

export interface CampaignWeeklyReportView {
  state: "available" | "unavailable";
  reason: string | null;
  currentPeriodLabel: string;
  previousPeriodLabel: string | null;
  source: CampaignEvidenceReference | null;
  sourceDetail: string;
  metrics: CampaignWeeklyMetricView[];
  coverage: string | null;
}

export interface CampaignAnalyticQuestionView {
  id: CampaignAnalyticQuestionId;
  label: string;
  answer: {
    state: "available" | "unavailable";
    summary: string;
    details: string[];
    periodLabel: string;
    source: CampaignEvidenceReference | null;
    sourceDetail: string;
  };
}

export interface CampaignWeeklyInsights {
  report: CampaignWeeklyReportView;
  questions: CampaignAnalyticQuestionView[];
}

export interface CampaignDecisionCockpitProps {
  canEdit: boolean;
  dataState: CampaignCockpitDataState;
  period: CampaignDecisionPeriod;
  kpis: CampaignObservedKpi[];
  deliveryDiagnostic: CampaignDeliveryReading | null;
  recommendation: CampaignPriorityRecommendation | null;
  campaigns: CampaignDecisionRow[];
  pastAttempts: CampaignPastAttempt[];
  dailySummary: CampaignDailySummary | null;
  activity: CampaignActivityEvent[];
  filters: CampaignCockpitFilters;
  operationalSummary: CampaignOperationalSummary;
  prospectSearch: CampaignProspectSearch;
  prospectPresentation: string;
  weeklyInsights: CampaignWeeklyInsights;
}
