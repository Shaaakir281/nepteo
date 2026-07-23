import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EDIT_ROLES } from "@/lib/memory";
import { MAX_PER_RUN, MAX_PER_DAY } from "@/lib/execution-rules";
import { ExecutionSwitch } from "../_components/execution-switch";
import { AutonomySelector } from "./_components/autonomy-selector";

export default async function AgentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const canEdit = EDIT_ROLES.includes(membership.role);

  const { data: org } = await supabase
    .from("organizations")
    .select("execution_paused, autonomy_level")
    .maybeSingle();
  const paused = Boolean(org?.execution_paused);
  const autonomy = (org?.autonomy_level as string) ?? "prepare";

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Agent &amp; garde-fous
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Vous gardez la main. L&apos;agent ne fait rien que vous n&apos;ayez
          autorisé, et rien ne part à l&apos;extérieur en mode sûr.
        </p>
      </div>

      <div className="space-y-4">
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

        {/* Niveau d'autonomie */}
        <Section
          title="Niveau d'autonomie"
          hint="Jusqu'où l'agent peut aller sans vous."
        >
          <AutonomySelector level={autonomy} canEdit={canEdit} />
        </Section>

        {/* Plafonds serveur */}
        <Section
          title="Plafonds de sécurité"
          hint="Appliqués côté serveur, jamais contournables depuis l'interface."
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat value={MAX_PER_RUN} label="messages par exécution" />
            <Stat value={MAX_PER_DAY} label="messages par jour" />
          </div>
        </Section>

        {/* Mode d'exécution */}
        <Section
          title="Mode d'exécution"
          hint="Ce que « Exécuter » fait réellement."
        >
          <div className="flex items-start gap-3 rounded-[12px] border border-line-soft bg-tint-soft px-4 py-3">
            <span className="mt-0.5 flex-none rounded-full bg-green-tint px-2.5 py-1 text-[11px] font-semibold text-green">
              Mode sûr
            </span>
            <p className="text-[12.5px] leading-relaxed text-body">
              L&apos;agent <b>prépare</b> les messages dans la boîte d&apos;envoi
              (statut « prepared ») — <b>aucun envoi externe</b>. Le mode réel
              (envoi SMTP) s&apos;activera à l&apos;étape B, derrière ces mêmes
              garde-fous et une configuration explicite.
            </p>
          </div>
        </Section>
      </div>
    </>
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[12px] border border-line-soft bg-tint-soft/50 px-4 py-3">
      <p className="font-display text-[22px] font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-[12px] text-muted">{label}</p>
    </div>
  );
}
