import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  enterprisePage,
  identityPanel,
  sideCards,
  enterpriseActions,
  onboardingPage,
  onboardingActions,
  identityWizard,
  companyProfile,
] = await Promise.all([
  readFile(
    new URL("../app/(cockpit)/entreprise/page.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL(
      "../app/(cockpit)/entreprise/_components/identity-panel.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../app/(cockpit)/entreprise/_components/side-cards.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL("../app/(cockpit)/entreprise/actions.ts", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../app/onboarding/identite/page.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../app/onboarding/identite/actions.ts", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL(
      "../app/onboarding/identite/_components/identity-wizard.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL("../lib/research/company-profile.ts", import.meta.url),
    "utf8",
  ),
]);

test("identité — tout marqueur démo rend les formulaires explicitement non éditables", () => {
  assert.match(enterprisePage, /readDemoPresentation\(/);
  assert.match(enterprisePage, /\.hasDemoMarker/);
  assert.match(
    enterprisePage,
    /mutationBlockedByDemo=\{identityMutationBlocked\}/,
  );
  assert.match(
    enterprisePage,
    /tab === "identite" && identityMutationBlocked[\s\S]*consultable en lecture seule pendant le scénario actif/,
  );
  assert.match(enterprisePage, /: INTRO\[tab\]/);

  assert.match(
    identityPanel,
    /const editable = canEdit && !mutationBlockedByDemo/,
  );
  assert.match(
    identityPanel,
    /Scénario Nepteo actif — identité en lecture seule\./,
  );
  assert.match(
    identityPanel,
    /Ouvrir les connecteurs pour retirer le scénario/,
  );
  assert.match(identityPanel, /IdentityCard mem=\{mem\} canEdit=\{editable\}/);
  assert.match(sideCards, /blockedByDemo \?/);
  assert.match(
    sideCards,
    /L&apos;analyse de site est désactivée tant que le scénario Nepteo/,
  );
  assert.match(sideCards, /Retirer le scénario dans Connecteurs/);
});

test("identité — les écritures réelles restent gardées côté serveur", () => {
  assert.match(enterpriseActions, /isDemoModeOrMutationActive\(/);
  assert.match(enterpriseActions, /withRealDataMutationLock\(/);
  assert.match(onboardingActions, /isDemoModeOrMutationActive\(/);
  assert.match(onboardingActions, /withRealDataMutationLock\(/);
});

test("analyse de site — contrôle et appel externe partagent le verrou atomique", () => {
  assert.match(companyProfile, /withRealDataMutationLock\(/);
  assert.doesNotMatch(
    companyProfile,
    /export async function researchCompanyProfile/,
    "la primitive non verrouillée ne doit pas devenir un point d'entrée public",
  );
  assert.match(companyProfile, /DemoDataMutationBlockedError/);
  assert.match(companyProfile, /reason: "demo_active"/);
  assert.match(companyProfile, /DemoBusyError/);
  assert.match(companyProfile, /reason: "busy"/);

  const lockStart = companyProfile.indexOf(
    "return await withRealDataMutationLock",
  );
  const orgRead = companyProfile.indexOf('.from("organizations")', lockStart);
  const researchCall = companyProfile.indexOf(
    "return researchCompanyProfile",
    lockStart,
  );
  assert.ok(lockStart >= 0 && orgRead > lockStart && researchCall > orgRead);
});

test("analyse de site — la route et son retour client expliquent le blocage", () => {
  assert.match(onboardingPage, /isDemoModeOrMutationActive\(/);
  assert.match(onboardingPage, /let mutationBlocked = true/);
  assert.match(
    onboardingPage,
    /Retirez d'abord les données de démonstration avant d'analyser un site/,
  );
  assert.match(identityWizard, /demo_active:/);
  assert.match(
    identityWizard,
    /Retirez d'abord les données de démonstration avant d'analyser un site/,
  );
});
