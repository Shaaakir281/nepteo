import { createClient } from "@/lib/supabase/server";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  prepared: { label: "Préparé", cls: "bg-tint text-violet" },
  sent: { label: "Envoyé", cls: "bg-green-tint text-green" },
  failed: { label: "Échec", cls: "bg-red-tint text-red" },
};

/**
 * Envois préparés — déplacé de l'onglet Agent (C5), en tête de `/journal`.
 * Composant serveur, lecture seule : en mode sûr, aucun message n'est
 * réellement parti, tout reste au statut « préparé ».
 */
export async function PreparedOutbox() {
  const supabase = await createClient();

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

  return (
    <div className="mb-5 rounded-[18px] border border-line-soft bg-white shadow-card">
      <div className="border-b border-line-soft px-[22px] py-4">
        <h3 className="font-display text-[15px] font-semibold">
          Envois préparés
        </h3>
        <p className="mt-0.5 text-[12px] text-muted">
          Les messages que l&apos;agent a préparés — en mode sûr, rien n&apos;est
          parti.
        </p>
      </div>
      <div className="p-[22px]">
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
      </div>
    </div>
  );
}
