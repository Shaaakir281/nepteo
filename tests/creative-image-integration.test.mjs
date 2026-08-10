import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/creative/image/route.ts", import.meta.url),
  "utf8",
);
const provider = fs.readFileSync(
  new URL("../lib/openai-image.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../supabase/migrations/0028_creative_assets.sql", import.meta.url),
  "utf8",
);
const deployWorkflow = fs.readFileSync(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);
const storyPreview = fs.readFileSync(
  new URL(
    "../app/(cockpit)/contenu/_components/story-preview.tsx",
    import.meta.url,
  ),
  "utf8",
);
const selectionRoute = fs.readFileSync(
  new URL("../app/api/creative/[id]/select/route.ts", import.meta.url),
  "utf8",
);
const creativeAssetsLoader = fs.readFileSync(
  new URL("../lib/creative-assets.ts", import.meta.url),
  "utf8",
);
const contentPage = fs.readFileSync(
  new URL("../app/(cockpit)/contenu/page.tsx", import.meta.url),
  "utf8",
);
const workspace = fs.readFileSync(
  new URL(
    "../app/(cockpit)/contenu/_components/creative-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const executionSwitch = fs.readFileSync(
  new URL(
    "../app/(cockpit)/_components/execution-switch.tsx",
    import.meta.url,
  ),
  "utf8",
);
const cronRoute = fs.readFileSync(
  new URL("../app/api/cron/sync/route.ts", import.meta.url),
  "utf8",
);
const journal = fs.readFileSync(
  new URL("../lib/journal.ts", import.meta.url),
  "utf8",
);

test("creative image — journalise la demande avant l'appel externe", () => {
  const requested = route.indexOf('event: "creative_image_requested"');
  const external = route.indexOf("await generateOpenAIImage");
  assert.ok(requested > 0);
  assert.ok(external > requested);
  assert.match(migration, /'creative_image_generated'/);
});

test("creative image — rattache la demande et le résultat à la campagne", () => {
  assert.match(route, /campaignId: z\.string\(\)\.uuid\(\)\.nullable\(\)\.optional\(\)/);
  assert.match(route, /campaignImageObjective\(campaign, parsed\.data\.objective\)/);
  assert.ok(
    (route.match(/action_id: campaign\?\.id \?\? null/g)?.length ?? 0) >= 2,
  );
  assert.match(migration, /action_id,[\s\S]*'creative_image_generated'/);
});

test("creative image — réserve le quota avant l'appel payant et persiste ensuite", () => {
  const reservation = route.indexOf('"reserve_creative_generation"');
  const external = route.indexOf("await generateOpenAIImage");
  const upload = route.indexOf(".upload(storagePath");
  const record = route.indexOf('"record_creative_asset"');
  assert.ok(reservation > 0 && reservation < external);
  assert.ok(upload > external && record > upload);
});

test("creative image — reste serveur, borné et configurable", () => {
  assert.match(provider, /process\.env\.OPENAI_API_KEY/);
  assert.match(provider, /process\.env\.OPENAI_IMAGE_MODEL \|\| "gpt-image-2"/);
  assert.match(provider, /AbortSignal\.timeout\(125_000\)/);
  assert.match(provider, /output_format: "jpeg"/);
  assert.match(route, /z\.string\(\)\.trim\(\)\.min\(3\)\.max\(500\)/);
  assert.doesNotMatch(provider, /NEXT_PUBLIC_OPENAI/);
  assert.match(
    deployWorkflow,
    /OPENAI_API_KEY is required for the campaign Story studio/,
  );
  assert.match(deployWorkflow, /OPENAI_IMAGE_MODEL: \$\{\{ vars\.OPENAI_IMAGE_MODEL \}\}/);
  assert.match(deployWorkflow, /OPENAI_IMAGE_MODEL must be a GPT Image model/);
});

test("creative image — distingue modération, quota et panne fournisseur", () => {
  assert.match(provider, /code === "moderation_blocked"/);
  assert.match(provider, /response\.status === 429/);
  assert.match(route, /event: "creative_image_failed"/);
});

test("creative image — le téléchargement accepte aussi les URLs signées Supabase", () => {
  const crossOrigin = storyPreview.indexOf('source.crossOrigin = "anonymous"');
  const sourceUrl = storyPreview.indexOf("source.src = image");
  assert.ok(crossOrigin > 0 && crossOrigin < sourceUrl);
});

test("creative image — génération et sélection respectent l'isolation démo", () => {
  assert.match(route, /withRealDataMutationLock\(admin, ctx\.orgId/);
  assert.match(route, /DemoDataMutationBlockedError/);
  assert.match(selectionRoute, /withRealDataMutationLock\(admin, ctx\.orgId/);
  assert.match(selectionRoute, /DemoDataMutationBlockedError/);
});

test("creative image — libère le verrou organisation pendant l'appel OpenAI", () => {
  const external = route.indexOf("await generateOpenAIImage");
  const firstLock = route.indexOf("withRealDataMutationLock(admin, ctx.orgId");
  const persistenceLock = route.lastIndexOf(
    "withRealDataMutationLock(admin, ctx.orgId",
  );
  assert.ok(firstLock > 0 && external > firstLock && persistenceLock > external);
  assert.match(route, /storage_path: storagePath[\s\S]*\.upload\(storagePath/);
  assert.match(route, /request_id", prepared\.requestId[\s\S]*reconciledAsset/);
  assert.match(route, /storage_reconciliation/);
  assert.match(creativeAssetsLoader, /purgeAbandonedCreativeObjects/);
  assert.match(creativeAssetsLoader, /\.remove\(\[request\.storage_path\]\)/);
  assert.match(creativeAssetsLoader, /failedResult\.error \|\| reservedResult\.error/);
  assert.match(creativeAssetsLoader, /reason: "retention_unavailable"/);
  const claim = creativeAssetsLoader.indexOf('"claim_creative_storage_cleanup"');
  const remove = creativeAssetsLoader.indexOf(".remove([request.storage_path])");
  const finish = creativeAssetsLoader.indexOf('"finish_creative_storage_cleanup"', remove);
  assert.ok(claim > 0 && remove > claim && finish > remove);
  assert.match(cronRoute, /Promise\.allSettled/);
  assert.match(cronRoute, /websitePreviewResult\.status === "fulfilled"/);
  assert.match(cronRoute, /creativeStorageResult\.status === "fulfilled"/);
  assert.match(cronRoute, /creative_storage_retention: creativeStorageRetention/);
  assert.match(cronRoute, /error: connectorReadError/);
  assert.match(cronRoute, /results\.every\(\(result\) => !result\.error\)/);
  assert.match(cronRoute, /analyzed\.every\(\(result\) => !result\.error\)/);
  assert.match(cronRoute, /operationOk \? 200 : 503/);
});

test("creative image — le journal nomme aussi la validation tardive", () => {
  assert.match(journal, /creative_image_validated: "Visuel de campagne validé"/);
});

test("creative image — restaure les créations libres et les livrables validés", () => {
  assert.match(creativeAssetsLoader, /export async function loadFreeCreativeAssets/);
  assert.match(creativeAssetsLoader, /\.is\("action_id", null\)/);
  assert.match(creativeAssetsLoader, /\{ count: "exact" \}/);
  assert.match(creativeAssetsLoader, /\.range\(from, to\)/);
  assert.match(
    contentPage,
    /\.in\("status", \["proposed", "postponed", "approved"\]\)/,
  );
  assert.match(contentPage, /requestedCampaignId[\s\S]*\.eq\("id", requestedCampaignId\)/);
  assert.match(contentPage, /loadFreeCreativeAssets/);
  assert.match(workspace, /initialCreativeAssets\.find\(\(asset\) => asset\.actionId === null\)/);
  assert.match(
    workspace,
    /campaign\?\.status === "approved" &&[\s\S]*asset\.status === "validated"/,
  );
  assert.match(workspace, /!campaignLocked \|\| asset\.status === "validated"/);
  assert.match(workspace, /Campagne validée · visuel final/);
  assert.match(workspace, /initialCampaignId && !requestedCampaign/);
  assert.match(workspace, /freeAssetTotal}[\s\S]*au total/);
  assert.match(workspace, /Plus anciennes/);
});

test("creative image — une campagne validée sans visuel peut le finaliser plus tard", () => {
  assert.match(route, /\.in\("status", \["proposed", "postponed", "approved"\]\)/);
  assert.match(
    migration,
    /action\.status in \('proposed', 'postponed', 'approved'\)[\s\S]*action\.status <> 'approved'[\s\S]*status = 'validated'/i,
  );
  assert.match(migration, /v_target_status := 'validated'/);
  assert.match(migration, /v_event := 'creative_image_validated'/);
  assert.match(selectionRoute, /status !== "selected" && status !== "validated"/);
  assert.match(workspace, /Campagne déjà validée · choisissez une version/);
});

test("creative image — ne signe que les campagnes déjà retenues pour Aujourd'hui", () => {
  const queueData = fs.readFileSync(
    new URL("../app/(cockpit)/_lib/today-queue-data.ts", import.meta.url),
    "utf8",
  );
  const priority = queueData.indexOf("const prioritizedQueue = prioritizeTodayActions");
  const signedAssets = queueData.indexOf("await loadCampaignCreativeAssets");
  assert.ok(priority > 0 && signedAssets > priority);
  assert.match(
    queueData.slice(priority, signedAssets + 500),
    /prioritizedQueue[\s\S]*loadCampaignCreativeAssets[\s\S]*prioritizedQueue/,
  );
});

test("creative image — l'état inconnu du coupe-circuit reste visible et fermé", () => {
  const queueData = fs.readFileSync(
    new URL("../app/(cockpit)/_lib/today-queue-data.ts", import.meta.url),
    "utf8",
  );
  assert.match(queueData, /error: organizationReadError/);
  assert.match(queueData, /organizationReadError[\s\S]*\? null/);
  assert.match(executionSwitch, /paused: boolean \| null/);
  assert.match(executionSwitch, /État exécution indisponible/);
  assert.match(executionSwitch, /if \(busy \|\| on === null\) return/);
});
