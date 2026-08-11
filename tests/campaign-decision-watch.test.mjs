import assert from "node:assert/strict";
import test from "node:test";
import { campaignDecisionWatch } from "../lib/campaign-decision-watch.ts";

const comparison = (changes) => ({
  status: "available",
  period: { from: "2026-06-13", to: "2026-07-12" },
  current: {},
  previous: {},
  changes: {
    spend: null,
    conversions: null,
    revenue: null,
    cac: null,
    roas: null,
    cpm: { status: "unavailable", value: null, reason: "current_metric_unavailable" },
    ctr: { status: "unavailable", value: null, reason: "current_metric_unavailable" },
    ...changes,
  },
  source: {
    kind: "ad_metrics",
    currentPeriod: { from: "2026-07-13", to: "2026-08-11" },
    previousPeriod: { from: "2026-06-13", to: "2026-07-12" },
    currentRowCount: 3,
    previousRowCount: 3,
  },
});

test("Décision Campagnes — la baisse d’efficacité devient un point de vigilance", () => {
  assert.deepEqual(
    campaignDecisionWatch(comparison({
      spend: 0.174,
      conversions: -0.211,
      cac: 0.486,
    })),
    {
      title: "L’efficacité d’acquisition se dégrade",
      detail: "La dépense augmente de 17,4 %, tandis que les conversions reculent de 21,1 % et le coût par conversion augmente de 48,6 % par rapport à la période précédente.",
    },
  );
});

test("Décision Campagnes — une baisse conjointe du revenu et du ROAS est signalée", () => {
  assert.deepEqual(
    campaignDecisionWatch(comparison({ revenue: -0.12, roas: -0.18 })),
    {
      title: "Le rendement publicitaire se dégrade",
      detail: "Le revenu enregistré recule de 12 % et le ROAS recule de 18 % par rapport à la période précédente.",
    },
  );
});

test("Décision Campagnes — aucun signal n’est inventé sans comparaison cohérente", () => {
  assert.equal(
    campaignDecisionWatch({ status: "unavailable", reason: "no_previous_rows" }),
    null,
  );
  assert.equal(
    campaignDecisionWatch(comparison({ conversions: 0.2, cac: -0.1 })),
    null,
  );
});
