import { createClient } from "@/lib/supabase/server";
import { type MemoryContent } from "@/lib/memory";
import { profileMemoryCompletion } from "@/lib/memory-completion";
import { readMemory } from "@/lib/memory-store";
import { researchConfigured } from "@/lib/research/provider";
import { IdentityCard } from "./identity-card";
import { IdentityCompletionHero } from "./identity-completion-hero";
import { DocumentsDetails, LearningsDetails } from "./side-cards";
import Link from "next/link";

/**
 * Onglet « Identité » — repris tel quel de l'ancienne page `/entreprise`.
 * Composant serveur asynchrone : il lit lui-même la mémoire, pour que la page
 * ne charge que les données de l'onglet affiché.
 */
export async function IdentityPanel({
  canEdit,
  mutationBlockedByDemo,
  saved,
}: {
  canEdit: boolean;
  mutationBlockedByDemo: boolean;
  saved?: string;
}) {
  const supabase = await createClient();
  const memCtx = await readMemory(supabase);
  const mem: Partial<MemoryContent> = {};
  for (const [section, content] of Object.entries(memCtx)) {
    (mem as Record<string, unknown>)[section] = content ?? {};
  }
  const editable = canEdit && !mutationBlockedByDemo;
  const researchEnabled = researchConfigured();
  const completion = profileMemoryCompletion(memCtx);

  return (
    <>
      {mutationBlockedByDemo && (
        <div
          role="note"
          className="mb-4 rounded-[13px] border border-amber/30 bg-amber-tint px-4 py-3 text-[12.5px] leading-relaxed text-body"
        >
          <p className="font-semibold text-ink">
            Scénario Nepteo actif — identité en lecture seule.
          </p>
          <p className="mt-1">
            Retirez le scénario Nepteo avant de modifier la mémoire de
            l&apos;entreprise ou d&apos;analyser un site.
          </p>
          <Link
            href="/entreprise?onglet=connecteurs"
            className="mt-2 inline-block font-semibold text-violet hover:underline"
          >
            Ouvrir les connecteurs pour retirer le scénario →
          </Link>
        </div>
      )}

      {!canEdit && !mutationBlockedByDemo && (
        <p className="mb-4 rounded-[10px] bg-tint-soft px-4 py-2.5 text-[13px] text-muted">
          Lecture seule — votre rôle ne permet pas la modification.
        </p>
      )}

      <IdentityCompletionHero
        completed={completion.completed}
        canAnalyzeWebsite={editable && researchEnabled}
        researchEnabled={researchEnabled}
      />

      <IdentityCard
        mem={mem}
        offers={mem.offres?.items ?? []}
        canEdit={editable}
        saved={saved}
      />

      <div className="mt-5">
        <LearningsDetails />
        <DocumentsDetails
          canEdit={canEdit}
          researchEnabled={researchEnabled}
        />
      </div>

      <p className="mt-5 text-[11px] text-faint">
        Chaque champ est modifiable à tout moment et s&apos;applique immédiatement.
      </p>
    </>
  );
}
