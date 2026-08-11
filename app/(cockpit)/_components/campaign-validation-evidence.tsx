import {
  asRecord,
  firstBoolean,
  firstString,
  firstStringList,
} from "./validation-payload-utils";

type EvidenceKind = "observed" | "estimate" | "insufficient";

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

export function CampaignValidationEvidence({
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
  const window =
    firstString(
      estimate?.window,
      evidence?.window,
      root.observationWindow,
      root.sourceWindow,
    ) ??
    (firstString(evidenceSource?.from) && firstString(evidenceSource?.to)
      ? `${firstString(evidenceSource?.from)} → ${firstString(evidenceSource?.to)}`
      : null);
  const method =
    firstString(estimate?.method, evidence?.method, root.estimationMethod) ??
    firstString(evidenceMethod?.aggregation);
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
          : "Des observations ont servi au calcul ; elles ne prédisent pas le résultat futur.",
        window ? `Fenêtre déclarée : ${window}.` : "Fenêtre d’observation non fournie.",
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
        "Le résultat attendu et la confiance ne sont pas des performances observées.",
        method ? `Méthode déclarée : ${method}.` : "Méthode détaillée non fournie.",
        limitations.length > 0 ? `Limites : ${limitations.join(" ; ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (insufficient || rows.length === 0) {
    rows.push({
      kind: "insufficient",
      title: "Données insuffisantes",
      detail:
        "Les éléments disponibles ne suffisent pas à qualifier cette estimation de calibrée.",
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {rows.map((row) => (
        <EvidenceRow key={row.kind} {...row} />
      ))}
    </div>
  );
}
