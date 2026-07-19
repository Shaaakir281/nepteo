/** Types domaine — alignés sur supabase/migrations/0001_init.sql */

export type Role =
  | "admin"
  | "marketing"
  | "commercial"
  | "direction"
  | "lecture";

export type ConnectorType =
  | "crm"
  | "analytics"
  | "ads"
  | "email"
  | "payments"
  | "files";

export type ConnectorStatus = "connected" | "disconnected" | "error";

export type ActionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "postponed"
  | "executed"
  | "failed";

export type RiskLevel = "low" | "medium" | "high";

export type { MemoryContent, MemorySection, Offer } from "./memory";

export interface Organization {
  id: string;
  name: string;
  activity: string | null;
  created_at: string;
}

export interface Connector {
  id: string;
  organization_id: string;
  type: ConnectorType;
  provider: string; // ex: "hubspot", "ga4", "meta_ads", "stripe"
  status: ConnectorStatus;
  created_at: string;
}

/** Action proposée par l'agent — cœur du centre de validation. */
export interface AgentAction {
  id: string;
  organization_id: string;
  kind: string; // ex: "send_followup_email", "adjust_budget"
  title: string;
  finding: string; // constat
  rationale: string; // raison
  data_sources: string[]; // données utilisées
  expected_impact: string;
  confidence: number; // 0–1
  risk: RiskLevel;
  status: ActionStatus;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

export interface JournalEntry {
  id: string;
  organization_id: string;
  action_id: string | null;
  event: string; // ex: "action_proposed", "action_approved", "execution_started"
  actor: "agent" | "user";
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
