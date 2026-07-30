/**
 * Matrice unique des capacités applicatives.
 *
 * Une valeur de rôle inconnue reçoit toujours les capacités les plus
 * restrictives. Les policies RLS restent la frontière de sécurité pour les
 * lectures directes avec un JWT Supabase ; cette matrice protège les chemins
 * serveur qui utilisent le service role.
 */
export const APP_ROLES = [
  "admin",
  "marketing",
  "commercial",
  "direction",
  "lecture",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface RoleCapabilities {
  canEdit: boolean;
  canViewFinancials: boolean;
  canManageCampaigns: boolean;
}

const DENY_ALL: Readonly<RoleCapabilities> = Object.freeze({
  canEdit: false,
  canViewFinancials: false,
  canManageCampaigns: false,
});

export const ROLE_CAPABILITIES: Readonly<
  Record<AppRole, Readonly<RoleCapabilities>>
> = Object.freeze({
  admin: Object.freeze({
    canEdit: true,
    canViewFinancials: true,
    canManageCampaigns: true,
  }),
  marketing: Object.freeze({
    canEdit: true,
    canViewFinancials: true,
    canManageCampaigns: true,
  }),
  commercial: DENY_ALL,
  direction: Object.freeze({
    canEdit: true,
    canViewFinancials: true,
    canManageCampaigns: true,
  }),
  lecture: Object.freeze({
    canEdit: false,
    canViewFinancials: true,
    canManageCampaigns: false,
  }),
});

export function capabilitiesForRole(role: string): Readonly<RoleCapabilities> {
  if ((APP_ROLES as readonly string[]).includes(role)) {
    return ROLE_CAPABILITIES[role as AppRole];
  }
  return DENY_ALL;
}

/** Les actions de campagne peuvent embarquer dépenses, revenus ou budgets. */
export function isFinancialActionKind(kind: string | null | undefined): boolean {
  return kind === "launch_campaign" || Boolean(kind?.startsWith("ads_"));
}

/**
 * Allowlist des propositions commerciales sans donnée financière.
 * Un futur kind reste invisible au rôle commercial jusqu'à classification.
 */
export function isCommercialSafeActionKind(
  kind: string | null | undefined,
): boolean {
  return (
    kind === "complete_missing_emails" ||
    kind === "relaunch_priority" ||
    kind === "relaunch_dormant" ||
    kind === "classify_unlabeled" ||
    kind === "dedupe_emails" ||
    kind === "complete_missing_company" ||
    Boolean(kind?.startsWith("relaunch_stage_"))
  );
}
