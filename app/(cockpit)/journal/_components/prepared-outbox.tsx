import { createClient } from "@/lib/supabase/server";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  prepared: { label: "Préparé", cls: "bg-tint text-violet" },
  sent: { label: "Envoyé", cls: "bg-green-tint text-green" },
  failed: { label: "Échec", cls: "bg-red-tint text-red" },
};

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
  const outbox = (outboxRows ?? []) as Array<{
    id: string;
    to_email: string;
    subject: string;
    status: string;
    created_at: string;
  }>;
  const fmtDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <details className="mb-4 rounded-[13px] border border-line-soft bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] marker:content-none">
        <b className="font-semibold text-ink">Envois préparés</b>
        <span className="rounded-full bg-tint-soft px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-muted">
          {preparedCount ?? 0}
        </span>
      </summary>
      <div className="border-t border-line-soft px-4 py-3">
        <p className="mb-3 text-[11.5px] text-muted">
          Mode sûr : la préparation n&apos;est pas un envoi.
        </p>
        {outbox.length === 0 ? (
          <p className="text-[12.5px] text-faint">Aucun message préparé.</p>
        ) : (
          <ul className="space-y-1.5">
            {outbox.map((message) => {
              const badge = STATUS_BADGE[message.status] ?? {
                label: message.status,
                cls: "bg-tint-soft text-body",
              };
              return (
                <li key={message.id} className="flex items-center gap-3 rounded-[9px] border border-line-soft px-3 py-2">
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{message.subject}</p>
                    <p className="truncate text-[11px] text-muted">{message.to_email}</p>
                  </div>
                  <span className="flex-none text-[10.5px] text-faint">{fmtDate.format(new Date(message.created_at))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
