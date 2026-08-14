import type {
  BudgetResultsAttribution,
  BudgetResultsChange,
  BudgetResultsObservation,
  BudgetResultsPeriod,
  BudgetResultsSnapshot,
  BudgetResultsStateKind,
} from "@/lib/budget-results";

export const UNAVAILABLE = "Indisponible";

const STATE_COPY: Record<
  BudgetResultsStateKind,
  { label: string; title: string; description: string; className: string }
> = {
  ready: {
    label: "Complet",
    title: "Données disponibles",
    description: "Le dernier snapshot complet couvre la fenêtre de 30 jours.",
    className: "border-green/25 bg-green-tint text-green",
  },
  empty: {
    label: "Compte vide",
    title: "Compte Meta vide",
    description: "La collecte a abouti, mais aucune campagne n’a été déclarée par Meta.",
    className: "border-line-soft bg-tint-soft text-body",
  },
  missing: {
    label: "Absent",
    title: "Données absentes",
    description: "Aucune mesure exploitable n’est disponible pour ce périmètre.",
    className: "border-amber/25 bg-amber-tint text-amber",
  },
  stale: {
    label: "Périmé",
    title: "Données périmées",
    description: "Le dernier snapshot complet date de plus de 48 heures.",
    className: "border-amber/25 bg-amber-tint text-amber",
  },
  partial: {
    label: "Partiel",
    title: "Données partielles",
    description: "La couverture disponible ne permet pas de compléter toutes les mesures.",
    className: "border-amber/25 bg-amber-tint text-amber",
  },
  incompatible: {
    label: "Incompatible",
    title: "Données incompatibles",
    description: "Les observations ne partagent pas un périmètre suffisamment cohérent.",
    className: "border-red/20 bg-red-tint text-red",
  },
  error: {
    label: "Erreur",
    title: "Données en erreur",
    description: "La dernière lecture n’a pas produit de snapshot présentable.",
    className: "border-red/20 bg-red-tint text-red",
  },
};

export function formatMoney(value: number, currency: string | null) {
  if (!currency) return UNAVAILABLE;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 6,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTimestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatPeriod(period: BudgetResultsPeriod) {
  return `${formatDate(period.from)} – ${formatDate(period.to)}`;
}

export function formatAttribution(attribution: BudgetResultsAttribution | null) {
  if (!attribution) return UNAVAILABLE;
  return `${attribution.model} · ${attribution.windows.join(" + ")}`;
}

export function ObservationValue({
  observation,
  currency,
}: {
  observation: BudgetResultsObservation;
  currency: string | null;
}) {
  if (observation.status === "unavailable") {
    return <span className="text-muted">{UNAVAILABLE}</span>;
  }
  return <span>{formatMoney(observation.value, currency)}</span>;
}

export function TrendValue({
  change,
  format,
}: {
  change: BudgetResultsChange;
  format: (value: number) => string;
}) {
  if (change.status === "unavailable") {
    return <span className="text-muted">{UNAVAILABLE}</span>;
  }
  const relative = change.relative === null
    ? `${UNAVAILABLE} — base précédente nulle`
    : new Intl.NumberFormat("fr-FR", {
        style: "percent",
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      }).format(change.relative);
  return (
    <span className="block">
      <span className="font-semibold text-ink">{relative}</span>
      <span className="mt-0.5 block text-[9.5px] font-normal text-faint">
        {format(change.current)} · précédent {format(change.previous)}
      </span>
    </span>
  );
}

export function StateBanner({ snapshot }: { snapshot: BudgetResultsSnapshot }) {
  const copy = STATE_COPY[snapshot.state.kind];
  return (
    <div
      role={snapshot.state.kind === "error" || snapshot.state.kind === "incompatible" ? "alert" : "status"}
      className={`rounded-[12px] border px-4 py-3 ${copy.className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold">{copy.title}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.06em]">
          {copy.label}
        </span>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-body">{copy.description}</p>
      <p className="mt-1 text-[10px] text-muted">
        Dernière collecte complète :{" "}
        {snapshot.state.lastCompleteAt
          ? formatTimestamp(snapshot.state.lastCompleteAt, snapshot.account?.timezone ?? "UTC")
          : UNAVAILABLE}
      </p>
    </div>
  );
}

export function SnapshotMetadata({ snapshot }: { snapshot: BudgetResultsSnapshot }) {
  const account = snapshot.account;
  const items = [
    ["Devise", account?.currency ?? UNAVAILABLE],
    ["Fuseau", account?.timezone ?? UNAVAILABLE],
    ["Attribution", formatAttribution(account?.attribution ?? null)],
    ["Fraîcheur", account ? `${formatNumber(account.freshnessHours)} h` : UNAVAILABLE],
    ["Provenance", account ? "Meta · déclarée par le fournisseur" : UNAVAILABLE],
    ["Qualité", STATE_COPY[snapshot.state.kind].label],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[10px] border border-line-soft bg-tint-soft/35 px-3 py-2.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">{label}</p>
          <p className="mt-1 break-words text-[11px] font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}
