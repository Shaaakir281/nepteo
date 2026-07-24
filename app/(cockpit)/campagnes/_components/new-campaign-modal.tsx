"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_BUDGETS,
  type CampaignBrief,
  type CampaignPlan,
} from "@/lib/campaign-plan";
import { buildCampaignAction, submitCampaignAction } from "../actions";

const STEPS = ["Brief", "Construction", "Proposition", "Garde-fous"];
const BUILD_STEPS = [
  "Lecture de votre historique…",
  "Analyse de ce qui fonctionne…",
  "Rédaction de 2 messages et choix de l'audience…",
  "Prévision du coût par contact…",
];

export function NewCampaignModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [objectif, setObjectif] = useState<string>(CAMPAIGN_OBJECTIVES[0].value);
  const [canal, setCanal] = useState<string>(CAMPAIGN_CHANNELS[0].value);
  const [budgetJour, setBudgetJour] = useState<number>(CAMPAIGN_BUDGETS[0]);
  const [contexte, setContexte] = useState("");

  const [buildStep, setBuildStep] = useState(0);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [variants, setVariants] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setStep(1);
    setPlan(null);
    setVariants([]);
    setBuildStep(0);
    setDone(false);
  }
  function close() {
    setOpen(false);
    reset();
  }

  async function build() {
    setStep(2);
    setBuildStep(0);
    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(i + 1, BUILD_STEPS.length - 1);
      setBuildStep(i);
    }, 800);
    const minDelay = new Promise((r) => setTimeout(r, BUILD_STEPS.length * 800));
    try {
      const [res] = await Promise.all([
        buildCampaignAction(objectif, canal, budgetJour, contexte),
        minDelay,
      ]);
      if (res.ok && res.build) {
        setPlan(res.build.plan);
        setVariants(res.build.variants);
        setStep(3);
      } else {
        setStep(1);
      }
    } finally {
      clearInterval(timer);
    }
  }

  async function submit() {
    if (!plan) return;
    setSubmitting(true);
    const brief: CampaignBrief = { objectif, canal, budgetJour, contexte };
    try {
      const res = await submitCampaignAction(brief, plan, variants);
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[10px] bg-violet px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-deep"
      >
        + Nouvelle campagne
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/45 p-4 sm:p-12"
          onClick={close}
        >
          <div
            className="w-full max-w-[640px] rounded-[18px] bg-white shadow-[0_30px_80px_rgba(25,23,49,.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line-soft px-6 py-4">
              <h3 className="font-display text-[16px] font-semibold">
                Nouvelle campagne — l&apos;agent construit, vous arbitrez
              </h3>
              <button
                type="button"
                onClick={close}
                className="px-2 text-[15px] text-muted hover:text-ink"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Fil des étapes */}
            <div className="flex gap-1.5 border-b border-line-soft px-6 py-2.5">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    step === i + 1
                      ? "bg-tint text-violet-ink"
                      : step > i + 1
                        ? "text-green"
                        : "text-faint"
                  }`}
                >
                  {i + 1} · {s}
                </span>
              ))}
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
              {done ? (
                <div className="py-8 text-center">
                  <p className="text-[15px] font-semibold text-ink">
                    Campagne ajoutée à votre file ✓
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
                    Retrouvez-la dans « À valider » sur Aujourd&apos;hui. Rien
                    n&apos;est lancé sans votre accord.
                  </p>
                </div>
              ) : step === 1 ? (
                <>
                  <Picks
                    label="Objectif"
                    options={CAMPAIGN_OBJECTIVES.map((o) => ({ v: o.value, l: o.label }))}
                    value={objectif}
                    onPick={setObjectif}
                  />
                  <Picks
                    label="Canal"
                    options={CAMPAIGN_CHANNELS.map((c) => ({ v: c.value, l: c.label }))}
                    value={canal}
                    onPick={setCanal}
                  />
                  <Picks
                    label="Budget quotidien"
                    options={CAMPAIGN_BUDGETS.map((b) => ({ v: String(b), l: `${b} € / jour` }))}
                    value={String(budgetJour)}
                    onPick={(v) => setBudgetJour(Number(v))}
                  />
                  <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
                    Contexte pour l&apos;agent
                  </p>
                  <textarea
                    value={contexte}
                    onChange={(e) => setContexte(e.target.value)}
                    rows={3}
                    placeholder="Ex. mettre en avant l'offre découverte auprès des dirigeants de PME, reprendre le ton de nos meilleurs posts."
                    className="w-full resize-y rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
                  />
                  <p className="mt-3 text-[12px] text-muted">
                    Le brief prend 30 secondes — l&apos;agent fait le reste, à
                    partir de votre mémoire d&apos;entreprise.
                  </p>
                </>
              ) : step === 2 ? (
                <ul className="space-y-2.5">
                  {BUILD_STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5 text-[13px]">
                      <span
                        className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold ${
                          i <= buildStep
                            ? "bg-green-tint text-green"
                            : "bg-tint-soft text-faint"
                        }`}
                      >
                        {i < buildStep ? "✓" : i === buildStep ? "…" : ""}
                      </span>
                      <span className={i <= buildStep ? "text-ink" : "text-faint"}>
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : step === 3 && plan ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric l="Budget total" v={`${plan.budgetTotal} €`} />
                    <Metric l="Durée" v={`${plan.dureeJours} j`} />
                    <Metric l="Coût / contact" v={`≈ ${plan.coutContact} €`} />
                    <Metric l="Confiance" v={`${Math.round(plan.confiance * 100)} %`} />
                  </div>
                  <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
                    2 messages proposés — testés l&apos;un contre l&apos;autre
                  </p>
                  <div className="space-y-2">
                    {variants.map((v, i) => (
                      <div
                        key={i}
                        className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-body"
                      >
                        <b className="text-ink">{i === 0 ? "A · " : "B · "}</b>
                        {v}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] text-muted">
                    Résultat attendu : <b className="text-ink">{plan.contactsMin}–{plan.contactsMax} contacts</b>.
                    Prévision prudente, calibrée sur vos données. Chaque message
                    reste modifiable avant lancement.
                  </p>
                </>
              ) : step === 4 && plan ? (
                <div className="space-y-3">
                  <Guard
                    label="Plafond strict"
                    detail="L'agent ne peut jamais le dépasser, quelles que soient ses optimisations."
                    value={`${plan.capJour} € / j`}
                  />
                  <Guard
                    label="Arrêt automatique"
                    detail="Si le coût par contact dépasse ce seuil sur 3 jours, la campagne est coupée et vous êtes prévenu."
                    value={`${plan.arretContact} € / contact`}
                  />
                  <Guard
                    label="Votre validation d'abord"
                    detail="La campagne rejoint votre file — rien n'est lancé sans votre accord."
                    value="Requis"
                  />
                </div>
              ) : null}
            </div>

            {/* Pied */}
            {!done && (
              <div className="flex items-center justify-between gap-3 border-t border-line-soft px-6 py-4">
                <button
                  type="button"
                  onClick={() => (step > 1 && step !== 2 ? setStep(step - 1) : close())}
                  className="rounded-[9px] px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink"
                >
                  {step > 1 && step !== 2 ? "Retour" : "Annuler"}
                </button>
                {step === 1 && (
                  <button
                    type="button"
                    onClick={build}
                    className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep"
                  >
                    Lancer la construction
                  </button>
                )}
                {step === 2 && (
                  <span className="text-[12px] text-muted">L&apos;agent construit…</span>
                )}
                {step === 3 && (
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep"
                  >
                    Voir les garde-fous
                  </button>
                )}
                {step === 4 && (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50"
                  >
                    {submitting ? "Ajout…" : "Ajouter à ma file"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Picks({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <>
      <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-faint first:mt-0">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(o.v)}
            className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition ${
              value === o.v
                ? "border-violet bg-tint-soft text-violet-ink"
                : "border-line bg-white text-ink hover:border-violet/40"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </>
  );
}

function Metric({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-3 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-faint">{l}</p>
      <p className="mt-0.5 font-display text-[17px] font-semibold text-ink">{v}</p>
    </div>
  );
}

function Guard({ label, detail, value }: { label: string; detail: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-line-soft px-4 py-3">
      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-green-tint text-[11px] font-bold text-green">
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{detail}</p>
      </div>
      <span className="flex-none rounded-full bg-tint px-2.5 py-1 text-[11px] font-semibold text-violet">
        {value}
      </span>
    </div>
  );
}
