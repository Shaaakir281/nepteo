import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildConfirmationRedirectUrl } from "../lib/auth/confirmation-url.ts";

const [actions, signupPage, deployment] = await Promise.all([
  readFile(new URL("../app/(auth)/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(auth)/signup/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"),
]);

test("auth email — inscription et renvoi utilisent le même callback PKCE", () => {
  assert.equal(
    actions.match(/options: \{ emailRedirectTo: await confirmationRedirectUrl\(\) \}/g)?.length,
    2,
  );
  assert.match(
    actions,
    /export async function resendConfirmation[\s\S]*auth\.resend\(\{[\s\S]*type: "signup"/,
  );
});

test("auth email — la production ignore l'origine interne du conteneur", () => {
  assert.equal(
    buildConfirmationRedirectUrl({
      appUrl: "https://nepteo.bogasolution.com",
      requestOrigin: "http://0.0.0.0:3000",
      isProduction: true,
    }),
    "https://nepteo.bogasolution.com/auth/confirm",
  );
});

test("auth email — APP_URL est obligatoire et publique en production", () => {
  assert.throws(
    () =>
      buildConfirmationRedirectUrl({
        requestOrigin: "http://0.0.0.0:3000",
        isProduction: true,
      }),
    /APP_URL is required/,
  );
  assert.throws(
    () =>
      buildConfirmationRedirectUrl({
        appUrl: "http://0.0.0.0:3000",
        isProduction: true,
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      buildConfirmationRedirectUrl({
        appUrl: "https://0.0.0.0:3000",
        isProduction: true,
      }),
    /publicly reachable/,
  );
});

test("auth email — localhost reste disponible uniquement en développement", () => {
  assert.equal(
    buildConfirmationRedirectUrl({
      requestOrigin: "http://localhost:3001",
      isProduction: false,
    }),
    "http://localhost:3001/auth/confirm",
  );
});

test("auth email — le déploiement exige et injecte APP_URL", () => {
  const deployStep = deployment.slice(
    deployment.indexOf("- name: Deploy image and runtime environment"),
  );

  assert.match(deployment, /APP_URL: \$\{\{ vars\.APP_URL \}\}/);
  assert.match(deployment, /AZURE_LOCATION APP_URL NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(deployStep, /APP_URL: \$\{\{ vars\.APP_URL \}\}/);
  assert.match(deployStep, /"APP_URL=\$APP_URL"/);
});

test("auth email — les erreurs SMTP et de cadence restent honnêtes", () => {
  assert.match(actions, /email_address_not_authorized/);
  assert.match(actions, /over_email_send_rate_limit/);
  assert.match(actions, /over_request_rate_limit/);
  assert.match(actions, /emailDeliveryError\(error\.code\)/);
});

test("auth email — l'interface propose un renvoi sans mot de passe", () => {
  assert.match(signupPage, /id="resend-confirmation"/);
  assert.match(signupPage, /action=\{resendConfirmation\}/);
  assert.match(signupPage, /Renvoyer le lien de confirmation/);
  assert.equal(signupPage.match(/name="password"/g)?.length, 1);
});
