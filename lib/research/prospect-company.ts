import type { createAdminClient } from "@/lib/supabase/admin";
import { runResearch } from "@/lib/research/research";
import {
  buildProspectCompanyQuery,
  renderResearch,
  type ResearchSource,
} from "@/lib/research/research-rules";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Enrichissement d'un prospect — limité à SA SOCIÉTÉ.
 *
 * Décision produit et RGPD (docs/DECISIONS.md) : Nepteo ne lance aucune recherche
 * sur une personne physique nommée. On cherche l'entreprise (secteur, taille,
 * actualité publique) : c'est ce qui sert réellement à personnaliser une relance,
 * et la base légale est simple.
 *
 * Le cache est par société : dix contacts de la même entreprise = une recherche.
 */

export type ProspectCompanyResult =
  | { ok: true; summary: string; sources: ResearchSource[]; cached: boolean }
  | { ok: false; reason: string };

export async function researchProspectCompany(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string | null;
    company: string;
    website?: string | null;
    force?: boolean;
  },
): Promise<ProspectCompanyResult> {
  const company = (args.company ?? "").trim();
  if (!company) return { ok: false, reason: "no_company" };

  const research = await runResearch(admin, {
    orgId: args.orgId,
    actorId: args.actorId,
    kind: "prospect_company",
    subject: company,
    query: buildProspectCompanyQuery({ company, website: args.website }),
    force: args.force,
  });
  if (!research.ok) return { ok: false, reason: research.reason };

  return {
    ok: true,
    summary: renderResearch(research),
    sources: research.sources,
    cached: research.cached,
  };
}
