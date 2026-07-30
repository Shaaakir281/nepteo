import { ValidationSection } from "./validation-section";

/** Détails d'une proposition de campagne (budget, messages, garde-fous). */
export function CampaignDetails({
  payload,
}: {
  payload?: Record<string, unknown> | null;
}) {
  const p = (payload ?? {}) as {
    plan?: {
      budgetTotal?: number;
      dureeJours?: number;
      coutContact?: number;
      contactsMin?: number;
      contactsMax?: number;
      capJour?: number;
      arretContact?: number;
    };
    variants?: string[];
  };
  const plan = p.plan;
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (!plan) return null;

  return (
    <>
      <ValidationSection label="La campagne" />
      <div className="grid grid-cols-3 gap-2">
        <MiniStat l="Budget" v={`${plan.budgetTotal ?? "—"} €`} />
        <MiniStat l="Durée" v={`${plan.dureeJours ?? "—"} j`} />
        <MiniStat l="Coût / contact" v={`≈ ${plan.coutContact ?? "—"} €`} />
      </div>
      {(plan.contactsMin != null || plan.contactsMax != null) && (
        <p className="mt-2 text-[12.5px] text-body">
          Résultat attendu :{" "}
          <b className="text-ink">
            {plan.contactsMin}–{plan.contactsMax} contacts
          </b>
          .
        </p>
      )}

      {variants.length > 0 && (
        <>
          <ValidationSection label="Messages proposés (A/B)" />
          <div className="space-y-1.5">
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-3 py-2 text-[12.5px] leading-relaxed text-body"
              >
                <b className="text-ink">{i === 0 ? "A · " : "B · "}</b>
                {v}
              </div>
            ))}
          </div>
        </>
      )}

      <ValidationSection label="Garde-fous" />
      <ul className="space-y-1 text-[12.5px] text-body">
        <li>• Plafond strict : {plan.capJour ?? "—"} € / jour.</li>
        <li>
          • Arrêt automatique au-delà de {plan.arretContact ?? "—"} € / contact.
        </li>
        <li>
          • Rien n&apos;est lancé sans votre validation (lancement réel : étape
          séparée).
        </li>
      </ul>
    </>
  );
}

function MiniStat({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">
        {l}
      </p>
      <p className="mt-0.5 font-display text-[14px] font-semibold text-ink">
        {v}
      </p>
    </div>
  );
}
