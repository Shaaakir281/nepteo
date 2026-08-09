import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreativeImagePrompt,
  CREATIVE_IMAGE_FORMATS,
  isCreativeImageFormat,
  storyHeadline,
} from "../lib/creative-image-rules.ts";

test("creative image — le format story est un vrai 9:16 accepté par GPT Image 2", () => {
  assert.deepEqual(CREATIVE_IMAGE_FORMATS.story, {
    label: "Story",
    detail: "Instagram · Facebook",
    ratio: "9:16",
    size: "1008x1792",
  });
  assert.equal(1008 / 1792, 9 / 16);
  assert.equal(1008 % 16, 0);
  assert.equal(1792 % 16, 0);
});

test("creative image — valide uniquement les formats exposés", () => {
  for (const format of ["story", "square", "landscape"]) {
    assert.equal(isCreativeImageFormat(format), true);
  }
  for (const format of [
    "portrait",
    "toString",
    "constructor",
    "__proto__",
    "",
    null,
    16,
  ]) {
    assert.equal(isCreativeImageFormat(format), false);
  }
});

test("creative image — le prompt ancre la marque et réserve le texte à l'interface", () => {
  const prompt = buildCreativeImagePrompt({
    objective: "Présenter l'offre découverte",
    format: "story",
    activity: "coaching sportif",
    offer: "bilan mobilité",
    audience: "seniors actifs",
    tone: "chaleureux",
  });
  assert.match(prompt, /Story \(9:16\)/);
  assert.match(prompt, /coaching sportif/);
  assert.match(prompt, /bilan mobilité/);
  assert.match(prompt, /seniors actifs/);
  assert.match(prompt, /aucun texte/i);
  assert.match(prompt, /zone calme/i);
});

test("creative image — le titre story reste compact", () => {
  assert.equal(storyHeadline("  Une   phrase courte  "), "Une phrase courte");
  const headline = storyHeadline("x".repeat(100));
  assert.equal(headline.length, 72);
  assert.ok(headline.endsWith("…"));
});
