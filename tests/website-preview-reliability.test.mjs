import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [openAi, preview, lab, result] = await Promise.all([
  readFile(new URL("../lib/research/openai-search.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/research/website-preview.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-lab.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../app/(cockpit)/entreprise/laboratoire-web/_components/website-preview-result.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
]);

test("website_preview — OpenAI impose un schéma JSON strict sur le même appel web", () => {
  assert.match(openAi, /export function websitePreviewTextFormat\(\)/);
  assert.match(openAi, /type: "json_schema"[\s\S]*strict: true/);
  assert.match(openAi, /required: \[[\s\S]*"activity_type"[\s\S]*"gaps"/);
  assert.match(openAi, /additionalProperties: false/);
  assert.match(
    openAi,
    /args\.kind === "website_preview"[\s\S]*text: \{ format: websitePreviewTextFormat\(\) \}/,
  );
  assert.doesNotMatch(openAi, /generateText|responses\.create/i);
});

test("website_preview — un ancien cache tronqué est invalidé avant le seul appel confirmé", () => {
  assert.match(preview, /invalidateUnusableCachedPreview/);
  assert.match(
    preview,
    /parseUsefulProposal\(cached\.answer\)[\s\S]*update\(\{ status: "failed" \}\)/,
  );
  assert.match(
    preview,
    /const research = await runResearch[\s\S]*markPreviewUnusable[\s\S]*reason: "nothing_found"/,
  );
  assert.doesNotMatch(preview, /retry|askOpenAiSearch|askPerplexity|generateText/);
});

test("laboratoire — l'usage reste visible sans présenter de plafond", () => {
  assert.match(lab, /analyses lancées aujourd'hui · sans limite/);
  assert.match(result, /analyses lancées aujourd&apos;hui · sans limite/);
  assert.doesNotMatch(lab, /quota\.remaining === 0|\$\{quota\.used\}\/\$\{quota\.limit\}/);
  assert.doesNotMatch(result, /quota\.remaining|quota\.limit/);
});
