import { createClient } from "@/lib/supabase/server";
import { icons } from "@/components/icons";
import { type MemoryContent } from "@/lib/memory";
import { readMemory } from "@/lib/memory-store";
import { researchConfigured } from "@/lib/research/provider";
import { IdentityCard } from "./identity-card";
import { OffersCard } from "./offers-card";
import { DocumentsCard, LearningsCard } from "./side-cards";
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

      <div className="mb-4 flex items-start gap-3 rounded-[18px] border border-line bg-gradient-to-b from-[#fbfbff] to-[#f4f3fc] px-5 py-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-line bg-white text-violet">
          {icons.bulb}
        </span>
        <div>
          <h4 className="font-display text-[13.5px] font-semibold">
            Remplissez ce que vous savez, comme vous le diriez à un client
          </h4>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">
            Pas besoin des bons termes marketing. Nepteo enrichira ensuite
            cette mémoire avec ce qu&apos;il observe dans vos données — et vous
            garderez le dernier mot sur chaque apprentissage.
          </p>
        </div>
      </div>

      {!canEdit && !mutationBlockedByDemo && (
        <p className="mb-4 rounded-[10px] bg-tint-soft px-4 py-2.5 text-[13px] text-muted">
          Lecture seule — votre rôle ne permet pas la modification.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <IdentityCard mem={mem} canEdit={editable} saved={saved} />
          <OffersCard
            offers={mem.offres?.items ?? []}
            canEdit={editable}
            saved={saved === "offres"}
          />
        </div>
        <div className="space-y-4">
          <DocumentsCard
            canEdit={editable}
            blockedByDemo={mutationBlockedByDemo}
            researchEnabled={researchConfigured()}
          />
          <LearningsCard />
        </div>
      </div>
    </>
  );
}
