import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveSingleMembership } from "@/lib/auth/membership-rules";
import { capabilitiesForRole } from "@/lib/auth/roles";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

interface OrganizationRef {
  name: string | null;
}

export interface CurrentMembership {
  organizationId: string;
  organizationName: string | null;
  role: string;
  canEdit: boolean;
  canViewFinancials: boolean;
  canManageCampaigns: boolean;
}

export interface CurrentAuthContext {
  supabase: ServerClient;
  user: User | null;
  membership: CurrentMembership | null;
}

/**
 * Source unique du contexte authentifié pour une requête serveur.
 *
 * `cache` évite que le layout et sa page relisent séparément l'utilisateur et
 * son membership. L'invariant bêta limite chaque utilisateur à une
 * organisation. Deux lignes sont tout de même lues pour détecter et bloquer un
 * schéma non migré ou incohérent, sans choisir silencieusement un tenant.
 */
export const getCurrentAuthContext = cache(
  async (): Promise<CurrentAuthContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { supabase, user: null, membership: null };
    }

    const { data: rows, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", user.id)
      .order("organization_id", { ascending: true })
      .limit(2);

    if (membershipError) {
      throw new Error("Impossible de charger le contexte d'organisation.");
    }

    const row = resolveSingleMembership(rows ?? []);

    if (!row) {
      return { supabase, user, membership: null };
    }

    const organizations = row.organizations as
      | OrganizationRef
      | OrganizationRef[]
      | null;
    const organization = Array.isArray(organizations)
      ? organizations[0]
      : organizations;
    const role = row.role as string;
    const capabilities = capabilitiesForRole(role);

    return {
      supabase,
      user,
      membership: {
        organizationId: row.organization_id as string,
        organizationName: organization?.name ?? null,
        role,
        ...capabilities,
      },
    };
  },
);

export interface EditorContext {
  userId: string;
  orgId: string;
  role: string;
  canEdit: boolean;
  canViewFinancials: boolean;
  canManageCampaigns: boolean;
}

/**
 * Forme compacte utilisée par les Server Actions et les routes OAuth.
 * Comme auparavant, l'absence de session ou de membership retourne `null`.
 */
export async function getEditorContext(): Promise<EditorContext | null> {
  const { user, membership } = await getCurrentAuthContext();
  if (!user || !membership) return null;

  return {
    userId: user.id,
    orgId: membership.organizationId,
    role: membership.role,
    canEdit: membership.canEdit,
    canViewFinancials: membership.canViewFinancials,
    canManageCampaigns: membership.canManageCampaigns,
  };
}
