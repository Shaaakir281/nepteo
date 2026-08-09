import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignCreativeSource,
  campaignImageObjective,
  recommendedFormatForChannel,
} from "../lib/campaign-creative-rules.ts";

const action = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "launch_campaign",
  title: "Lancer la campagne découverte sur Meta",
  status: "proposed",
  payload: {
    brief: {
      objective: "clients",
      channel: "meta",
      context: "Indépendants qui manquent de temps",
    },
    variants: ["Gagnez du temps sans sacrifier votre croissance.", "Variante B"],
  },
};

test("campaign creative — transforme une proposition en contexte prérempli", () => {
  assert.deepEqual(campaignCreativeSource(action), {
    id: action.id,
    title: action.title,
    status: "proposed",
    objective: "clients",
    channel: "meta",
    context: "Indépendants qui manquent de temps",
    headline: "Gagnez du temps sans sacrifier votre croissance.",
    recommendedFormat: "story",
  });
});

test("campaign creative — recommande la Story pour Meta, le paysage ailleurs", () => {
  assert.equal(recommendedFormatForChannel("meta"), "story");
  assert.equal(recommendedFormatForChannel("linkedin"), "landscape");
  assert.equal(recommendedFormatForChannel("google"), "landscape");
});

test("campaign creative — refuse les actions sans identité ou d'un autre type", () => {
  assert.equal(campaignCreativeSource({ ...action, id: "" }), null);
  assert.equal(campaignCreativeSource({ ...action, kind: "relaunch_priority" }), null);
  assert.equal(campaignCreativeSource({ ...action, payload: null })?.headline, action.title);
});

test("campaign creative — relit les anciens alias français sans masquer le contrat CAMP", () => {
  const source = campaignCreativeSource({
    ...action,
    payload: {
      brief: {
        objectif: "clients",
        canal: "meta",
        contexte: "Ancien snapshot",
      },
      variants: ["Message historique suffisamment précis."],
    },
  });
  assert.equal(source?.channel, "meta");
  assert.equal(source?.context, "Ancien snapshot");
  assert.equal(source?.recommendedFormat, "story");
});

test("campaign creative — le prompt final garde la campagne et le message édité", () => {
  const campaign = campaignCreativeSource(action);
  assert.ok(campaign);
  const objective = campaignImageObjective(campaign, "Une accroche ajustée");
  assert.match(objective, /Lancer la campagne découverte/);
  assert.match(objective, /Indépendants qui manquent de temps/);
  assert.match(objective, /Une accroche ajustée/);
});
