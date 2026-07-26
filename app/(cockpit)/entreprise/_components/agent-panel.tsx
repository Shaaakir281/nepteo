import { createClient } from "@/lib/supabase/server";
import { MAX_PER_RUN, MAX_PER_DAY } from "@/lib/execution-rules";
import { ExecutionSwitch } from "../../_components/execution-switch";
import { AutonomySelector } from "../../agent/_components/autonomy-selector";

/**
 * Onglet « Agent » — repris de l'ancienne page `/agent`, qui redirige
 * désormais ici. Depuis C5, tient en deux notions : le curseur d'autonomie
 * (+ la note de plafonds qu'il porte) et le bouton d'arrêt. « Mode
 * démonstration » a rejoint l'état vide de l'onglet Connecteurs, et
 * « Envois préparés » vit désormais en tête de `/journal` — aucune logique
 * d'exécution modifiée par ces déplacements.
 */
export async function AgentPanel({ canEdit }: { canEdit: boolean }) {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("execution_paused, autonomy_level")
    .maybeSingle();
  const paused = Boolean(org?.execution_paused);
  const autonomy = (org?.autonomy_level as string) ?? "prepare";

  return (
    <div className="space-y-4">
      {/* Niveau d'autonomie */}
      <Section
        title="Niveau d'autonomie"
        hint="Jusqu'où l'agent peut aller sans vous."
      >
        <AutonomySelector level={autonomy} canEdit={canEdit} />
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          Plafonds serveur : {MAX_PER_RUN} par exécution, {MAX_PER_DAY} par
          jour — non contournables.
        </p>
      </Section>

      {/* Bouton d'arrêt */}
      <Section
        title="Bouton d'arrêt"
        hint="Bloque immédiatement toute exécution, quelle que soit l'autonomie."
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] text-body">
            {paused
              ? "L'exécution est en pause : aucune action ne peut s'exécuter."
              : "L'exécution est active : les actions validées peuvent être préparées."}
          </p>
          {canEdit ? (
            <ExecutionSwitch paused={paused} />
          ) : (
            <span className="text-[12px] text-muted">Lecture seule</span>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
      <div className="border-b border-line-soft px-[22px] py-4">
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
        <p className="mt-0.5 text-[12px] text-muted">{hint}</p>
      </div>
      <div className="p-[22px]">{children}</div>
    </div>
  );
}
