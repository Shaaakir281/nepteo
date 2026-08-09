"use client";

import { useId, useRef } from "react";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { isRelanceKind } from "@/lib/draft-template";
import {
  campaignTypeLabel,
  channelLabel,
  metricLabel,
  metricUnit,
  objectiveLabel,
  type CampaignBrief,
  type CampaignPlan,
} from "@/lib/campaign-plan";
import type { CampaignStudioProposal } from "@/lib/campaign-studio";
import type { CampaignProjectionResult } from "@/lib/campaign-evidence";
import { decideAction } from "../actions";
import { ActionDraftEditor } from "./action-draft-editor";
import { ActionValueFeedback } from "./action-value-feedback";
import { CampaignCreativeDetails } from "./campaign-details";
import { ProspectDrafts } from "./prospect-drafts";
import { ValidationSection } from "./validation-section";
import type { CreativeAsset } from "@/lib/creative-asset-rules";

export interface QueueAction {
  id: string;
  kind: string;
  title: string;
  finding: string;
  rationale: string;
  data_sources: string[];
  expected_impact: string | null;
  confidence: number | null;
  risk: string;
  payload?: Record<string, unknown> | null;
  creatives?: CreativeAsset[];
}

const RISK_LABELS: Record<string, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
};

const DECISIONS = [
  ["approve", "Valider", "bg-violet text-white hover:bg-violet-deep"],
  ["postpone", "Reporter", "bg-tint-soft text-body hover:bg-tint"],
] as const;

function DecisionButtons({ id }: { id: string }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {DECISIONS.map(([decision, label, cls]) => (
          <form key={decision} action={decideAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value={decision} />
            <button
              type="submit"
              className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold transition ${cls}`}
            >
              {label}
            </button>
          </form>
        ))}
      </div>
      <form action={decideAction} className="rounded-[10px] border border-red/20 bg-red-tint/45 p-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="reject" />
        <label htmlFor={`rejection-reason-${id}`} className="text-[11px] font-semibold text-red">
          Raison du refus
        </label>
        <textarea
          id={`rejection-reason-${id}`}
          name="reason"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          placeholder="Expliquez ce qui doit être corrigé (3 à 500 caractères)."
          className="mt-1.5 block w-full resize-y rounded-[8px] border border-red/20 bg-white px-3 py-2 text-[12px] leading-relaxed text-body outline-none focus:border-red"
        />
        <button
          type="submit"
          className="mt-2 rounded-[9px] bg-red-tint px-3.5 py-1.5 text-[12.5px] font-semibold text-red transition hover:opacity-80"
        >
          Refuser avec cette raison
        </button>
      </form>
    </div>
  );
}

export function ValidationDrawer({
  action,
  canEdit,
  onClose,
}: {
  action: QueueAction | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const confidenceAvailable = Boolean(
    action &&
      action.confidence != null &&
      !action.kind.startsWith("ads_pause_") &&
      !(
        action.kind === "launch_campaign" &&
        !campaignProjectionAvailable(action.payload)
      ),
  );

  useDialogFocus({
    open: action !== null,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  return (
    <>
      {/* Tiroir de raisonnement (maquette docs/maquettes/) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity ${
          action ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={action ? undefined : true}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(440px,94vw)] flex-col bg-white shadow-[-20px_0_60px_rgba(25,23,49,.18)] transition-transform duration-300 ${
          action ? "translate-x-0" : "translate-x-[105%]"
        }`}
      >
        {action && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-line-soft px-6 py-5">
              <h3
                id={titleId}
                className="text-[15.5px] font-semibold leading-snug text-ink"
              >
                {action.title}
              </h3>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="flex-none px-2 py-1 text-[15px] text-muted hover:text-ink"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-1">
              <ValidationSection label="Constat détaillé" />
              <p className="text-[13px] leading-relaxed text-body">
                {action.finding}
              </p>

              <ValidationSection label="Pourquoi cette action" />
              <p className="text-[13px] leading-relaxed text-body">
                {action.rationale}
              </p>

              <ValidationSection label="Données utilisées" />
              {action.data_sources.map((source) => (
                <div
                  key={source}
                  className="flex items-start gap-2.5 border-b border-line-soft py-2.5 text-[12.5px] leading-relaxed text-body last:border-b-0"
                >
                  <i className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-violet" />
                  {source}
                </div>
              ))}

              {action.expected_impact && (
                <>
                  <ValidationSection label="Impact estimé" />
                  <p className="text-[13px] leading-relaxed text-body">
                    {action.expected_impact}
                  </p>
                </>
              )}

              <div className="mt-4 flex items-center gap-3 rounded-[13px] border border-line-soft bg-tint-soft px-4 py-3.5">
                <span className="font-display text-[22px] font-semibold text-violet-ink">
                  {!confidenceAvailable
                    ? "Non calculée"
                    : `${Math.round(action.confidence! * 100)} %`}
                </span>
                <p className="text-[12px] leading-snug text-body">
                  {!confidenceAvailable
                    ? "Aucun niveau de confiance calibré n'est disponible pour cette proposition."
                    : `Niveau de confiance déclaré par l'agent · ${RISK_LABELS[action.risk] ?? action.risk}. Ce pourcentage reste une estimation.`}
                </p>
              </div>

              {canEdit && !isRelanceKind(action.kind) && (
                <ActionValueFeedback
                  key={`value-${action.id}`}
                  actionId={action.id}
                  mode="evaluation"
                />
              )}

              {action.kind === "launch_campaign" && (
                <>
                  <CampaignEvidence
                    payload={action.payload}
                    dataSources={action.data_sources}
                    expectedImpact={action.expected_impact}
                  />
                  <CampaignProposalDetails payload={action.payload} />
                  <CampaignCreativeDetails
                    actionId={action.id}
                    creatives={action.creatives ?? []}
                  />
                </>
              )}

              {isRelanceKind(action.kind) && (
                <>
                  <ActionDraftEditor
                    key={action.id}
                    id={action.id}
                    canEdit={canEdit}
                  />
                  <ValidationSection label="Personnaliser par prospect" />
                  <p className="mb-1 text-[11.5px] leading-relaxed text-muted">
                    Un message individuel, appuyé sur les notes et les infos de
                    chaque contact.
                  </p>
                  <ProspectDrafts
                    key={action.id}
                    actionId={action.id}
                    canEdit={canEdit}
                  />
                  {canEdit && (
                    <ActionValueFeedback
                      key={`value-${action.id}`}
                      actionId={action.id}
                      mode="evaluation"
                      includeDraft
                    />
                  )}
                </>
              )}
            </div>

            {canEdit && (
              <div className="border-t border-line-soft px-6 py-4">
                <DecisionButtons id={action.id} />
                <p className="mt-2.5 text-[11px] text-faint">
                  {action.kind === "launch_campaign"
                    ? action.creatives?.some(
                        (creative) => creative.status === "selected",
                      )
                      ? "La campagne et le visuel retenu seront validés ensemble, sans lancement ni publication. CAMP-1 ne fournit aucune exécution."
                      : "La campagne sera validée — non lancée. Vous pourrez encore créer puis retenir son visuel dans le studio, sans publication. CAMP-1 ne fournit aucune exécution."
                    : action.kind.startsWith("ads_pause_")
                      ? "La validation conserve cette recommandation comme non appliquée. CAMP-2 ne fournit aucun bouton d'exécution publicitaire."
                    : "Après validation, vous pourrez demander la préparation sous garde-fous. Aucun envoi externe."}
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

type EvidenceKind = "observed" | "estimate" | "insufficient";

function CampaignEvidence({
  payload,
  dataSources,
  expectedImpact,
}: {
  payload?: Record<string, unknown> | null;
  dataSources: string[];
  expectedImpact: string | null;
}) {
  const root = asRecord(payload) ?? {};
  const projectionRoot = asRecord(root.projection);
  const estimate =
    asRecord(projectionRoot?.projection) ??
    asRecord(root.estimation) ??
    asRecord(root.estimate) ??
    asRecord(root.forecast);
  const evidence = asRecord(root.evidence) ?? asRecord(root.provenance);
  const evidenceSource = asRecord(evidence?.source);
  const evidenceMethod = asRecord(evidence?.method);
  const status = firstString(
    projectionRoot?.status,
    estimate?.status,
    evidence?.status,
    root.estimationStatus,
    root.estimateStatus,
    root.dataStatus,
  )?.toLowerCase();
  const statusIsInsufficient = Boolean(
    status && /insufficient|missing|unavailable|non[_ -]?disponible/.test(status),
  );
  const statusIsObserved = Boolean(
    (status === "available" && asRecord(evidence?.facts)) ||
      (status && /observed|observation|mesur|réel|reel/.test(status)),
  );
  const statusIsEstimate = Boolean(
    status && /estimate|estimated|estimation|forecast|prévision|prevision/.test(status),
  );
  const sourceSignalsObservation = dataSources.some((source) =>
    /observ|mesur|historique/i.test(source),
  );
  const hasObservedFacts = asRecord(evidence?.facts) !== null;
  const observed =
    hasObservedFacts ||
    (!statusIsInsufficient &&
      (statusIsObserved ||
      firstBoolean(
        estimate?.usesObservedData,
        evidence?.observed,
        root.usesObservedData,
        root.observedData,
      ) === true ||
      sourceSignalsObservation));
  const plan = asRecord(root.plan);
  const hasEstimatedOutput =
    statusIsEstimate ||
    estimate !== null ||
    expectedImpact !== null ||
    Boolean(
      plan &&
        [plan.contactsMin, plan.contactsMax, plan.costPerContact, plan.confidence].some(
          (value) => typeof value === "number" && Number.isFinite(value),
        ),
    );
  const insufficient =
    statusIsInsufficient ||
    firstBoolean(
      estimate?.insufficientData,
      evidence?.insufficient,
      root.insufficientData,
    ) === true ||
    (!observed && hasEstimatedOutput);
  const window = firstString(
    estimate?.window,
    evidence?.window,
    root.observationWindow,
    root.sourceWindow,
  ) ?? (
    firstString(evidenceSource?.from) && firstString(evidenceSource?.to)
      ? `${firstString(evidenceSource?.from)} → ${firstString(evidenceSource?.to)}`
      : null
  );
  const method = firstString(
    estimate?.method,
    evidence?.method,
    root.estimationMethod,
  ) ?? firstString(evidenceMethod?.aggregation);
  const limitations = firstStringList(
    estimate?.limits,
    estimate?.limitations,
    evidence?.limitations,
    root.estimationLimitations,
  );
  const explicitSources = firstStringList(
    estimate?.sources,
    evidence?.sources,
    root.observationSources,
  );
  const sources = explicitSources.length > 0 ? explicitSources : dataSources;
  const demo = root.demo === true;
  const rows: Array<{ kind: EvidenceKind; title: string; detail: string }> = [];

  if (observed) {
    rows.push({
      kind: "observed",
      title: demo ? "Données observées dans le scénario" : "Données observées",
      detail: [
        demo
          ? "Ces observations proviennent de données d’exemple et ne constituent pas une preuve terrain."
          : "Des observations ont servi d’entrée au calcul ; elles ne constituent pas le résultat futur de la campagne.",
        window ? `Fenêtre déclarée : ${window}.` : "Fenêtre d’observation non fournie dans ce payload.",
        sources.length > 0 ? `Sources déclarées : ${sources.join(", ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (hasEstimatedOutput) {
    rows.push({
      kind: "estimate",
      title: "Estimation",
      detail: [
        "Le résultat attendu et le niveau de confiance ne sont pas des performances observées.",
        method ? `Méthode déclarée : ${method}.` : "Méthode détaillée non fournie dans ce payload.",
        limitations.length > 0 ? `Limites déclarées : ${limitations.join(" ; ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (insufficient) {
    rows.push({
      kind: "insufficient",
      title: "Données insuffisantes",
      detail:
        "Les éléments disponibles ne suffisent pas à qualifier cette estimation de calibrée. L’ordre de grandeur doit être relu comme une hypothèse prudente.",
    });
  }

  if (rows.length === 0) {
    rows.push({
      kind: "insufficient",
      title: "Données insuffisantes",
      detail:
        "Ce payload ne fournit ni provenance d’observation ni méthode d’estimation vérifiable.",
    });
  }

  return (
    <>
      <ValidationSection label="Nature des informations" />
      <div className="space-y-2">
        {rows.map((row) => (
          <EvidenceRow key={row.kind} {...row} />
        ))}
      </div>
    </>
  );
}

function EvidenceRow({
  kind,
  title,
  detail,
}: {
  kind: EvidenceKind;
  title: string;
  detail: string;
}) {
  const style =
    kind === "observed"
      ? "border-green/25 bg-green-tint"
      : kind === "estimate"
        ? "border-violet/20 bg-tint-soft"
        : "border-amber/25 bg-amber-tint";
  return (
    <div className={`rounded-[11px] border px-3.5 py-3 ${style}`}>
      <p className="text-[12.5px] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-body">{detail}</p>
    </div>
  );
}

function CampaignProposalDetails({
  payload,
}: {
  payload?: Record<string, unknown> | null;
}) {
  const p = (payload ?? {}) as {
    brief?: CampaignBrief;
    plan?: CampaignPlan;
    projection?: CampaignProjectionResult;
    variants?: string[];
    studio?: CampaignStudioProposal;
  };
  const brief = p.brief;
  const plan = p.plan;
  const projection =
    p.projection?.status === "available" ? p.projection.projection : null;
  const variants = Array.isArray(p.variants) ? p.variants : [];

  return (
    <>
      {plan && (
        <>
          <ValidationSection label="Proposition de campagne" />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Budget proposé" value={`${plan.totalBudget ?? "—"} €`} />
            <MiniStat label="Durée" value={`${plan.durationDays ?? "—"} j`} />
            <MiniStat
              label="Coût / conversion estimé"
              value={
                projection === null
                  ? "Données insuffisantes"
                  : `${projection.costPerContact.low}–${projection.costPerContact.high} €`
              }
            />
          </div>
          {projection && (
            <p className="mt-2 text-[12.5px] text-body">
              Ordre de grandeur estimé, fondé sur les 30 derniers jours observés :{" "}
              <b className="text-ink">
                {projection.volume.low}–{projection.volume.high} conversions
              </b>
              {" · "}ROAS {projection.roas.low}–{projection.roas.high}. Cette bande de
              planification est heuristique, pas une garantie.
            </p>
          )}
        </>
      )}

      {brief && (
        <>
          <ValidationSection label="Brief validé" />
          <dl className="space-y-2 text-[12.5px] leading-relaxed text-body">
            <BriefLine label="Objectif" value={objectiveLabel(brief.objective)} />
            <BriefLine label="Étape" value={campaignTypeLabel(brief.campaignType)} />
            <BriefLine label="Audience" value={brief.audience} />
            <BriefLine label="Offre" value={brief.offer} />
            <BriefLine label="Hypothèse" value={brief.hypothesis} />
            <BriefLine label="Canal" value={channelLabel(brief.channel)} />
            <BriefLine
              label="Succès visé"
              value={`${metricLabel(brief.primaryMetric)} ≥ ${brief.successThreshold} ${metricUnit(brief.primaryMetric)}`}
            />
            {brief.context && <BriefLine label="Contexte" value={brief.context} />}
          </dl>
        </>
      )}

      {variants.length > 0 && (
        <>
          <ValidationSection label="Hooks sélectionnés" />
          <div className="space-y-1.5">
            {variants.map((variant, index) => (
              <div
                key={`${index}-${variant}`}
                className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-3 py-2 text-[12.5px] leading-relaxed text-body"
              >
                <b className="text-ink">{String.fromCharCode(65 + index)} · </b>
                {variant}
              </div>
            ))}
          </div>
        </>
      )}

      {p.studio && (
        <>
          <ValidationSection label="Structure et allocation" />
          <div className="space-y-2">
            {p.studio.adSets.map((adSet) => (
              <div key={adSet.id} className="rounded-[10px] border border-line-soft px-3 py-2 text-[12px] text-body">
                <p className="font-semibold text-ink">{adSet.name} · {adSet.allocationPercent} % · {adSet.budget} €</p>
                <p className="mt-0.5">{adSet.audience}</p>
              </div>
            ))}
          </div>
          <ValidationSection label="Formats attendus" />
          <p className="text-[12px] leading-relaxed text-body">
            {p.studio.expectedFormats.map((format) => format.label).join(" · ")}. Aucun format n&apos;a encore été contrôlé par un fournisseur.
          </p>
        </>
      )}

      <ValidationSection label="Limites de la proposition" />
      <ul className="space-y-1 text-[12.5px] text-body">
        <li>
          • Budget journalier inscrit dans la proposition : {plan?.dailyCap ?? "—"} €.
          Ce montant n&apos;est pas un contrôle fournisseur actif.
        </li>
        <li>
          • Condition à vérifier avant tout lancement futur : seuil de lecture de{" "}
          {plan?.stopCostPerContact ?? "—"} € / conversion.
        </li>
        <li>
          • Aucun préflight fournisseur ni lancement n&apos;est disponible dans
          CAMP-1 ; la validation conserve uniquement la proposition.
        </li>
      </ul>
    </>
  );
}

function BriefLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold text-ink">{label} : </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-tint-soft/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[14px] font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function campaignProjectionAvailable(
  payload?: Record<string, unknown> | null,
): boolean {
  const projection = asRecord(asRecord(payload)?.projection);
  return projection?.status === "available" && asRecord(projection.projection) !== null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function firstStringList(...values: unknown[]): string[] {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (Array.isArray(value)) {
      const strings = value.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      );
      if (strings.length > 0) return strings.map((item) => item.trim());
    }
  }
  return [];
}
