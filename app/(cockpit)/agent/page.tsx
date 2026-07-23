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

  const { count: preparedCount } = await supabase
    .from("outbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "prepared");
  const { data: outboxRows } = await supabase
    .from("outbox_messages")
    .select("id, to_email, subject, status, created_at")
    .order("created_at", { ascending: false })
    .limit(15);
  const outbox = (outboxRows ?? []) as {
    id: string;
    to_email: string;
    subject: string;
    status: string;
    created_at: string;
  }[];
  const fmtDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    prepared: { label: "Préparé", cls: "bg-tint text-violet" },
    sent: { label: "Envoyé", cls: "bg-green-tint text-green" },
    failed: { label: "Échec", cls: "bg-red-tint text-red" },
  };

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
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[12px] border-2 border-violet bg-tint-soft px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green" />
                <span className="text-[13px] font-semibold text-ink">
                  Mode sûr
                </span>
                <span className="ml-auto rounded-full bg-green-tint px-2 py-0.5 text-[10px] font-semibold text-green">
                  Actif
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                L&apos;agent prépare les messages (statut « préparé »). Aucun
                envoi externe.
              </p>
            </div>
            <div className="rounded-[12px] border border-line bg-white px-4 py-3 opacity-70">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-faint" />
                <span className="text-[13px] font-semibold text-muted">
                  Mode réel — envoi SMTP
                </span>
                <span className="ml-auto rounded-full bg-tint-soft px-2 py-0.5 text-[10px] font-semibold text-faint">
                  Bientôt · étape B
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Enverra réellement les messages préparés, derrière ces mêmes
                garde-fous et une configuration SMTP explicite.
              </p>
            </div>
          </div>
        </Section>

        {/* Envois préparés (boîte d'envoi) */}
        <Section
          title="Envois préparés"
          hint="Les messages que l'agent a préparés — en mode sûr, rien n'est parti."
        >
          {outbox.length === 0 ? (
            <p className="text-[13px] text-muted">
              Aucun message préparé pour l&apos;instant. Validez puis exécutez
              une relance pour les voir apparaître ici.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] text-muted">
                {preparedCount ?? 0} message
                {(preparedCount ?? 0) > 1 ? "s" : ""} préparé
                {(preparedCount ?? 0) > 1 ? "s" : ""} · {outbox.length} récent
                {outbox.length > 1 ? "s" : ""} affiché
                {outbox.length > 1 ? "s" : ""}
              </p>
              <ul className="space-y-1.5">
                {outbox.map((m) => {
                  const badge = STATUS_BADGE[m.status] ?? {
                    label: m.status,
                    cls: "bg-tint-soft text-body",
                  };
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-[10px] border border-line-soft px-3.5 py-2.5"
                    >
                      <span
                        className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {m.subject}
                        </p>
                        <p className="truncate text-[11.5px] text-muted">
                          {m.to_email}
                        </p>
                      </div>
                      <span className="flex-none text-[11px] text-faint">
                        {fmtDate.format(new Date(m.created_at))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
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
