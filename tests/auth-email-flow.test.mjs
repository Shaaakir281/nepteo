import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildConfirmationRedirectUrl,
  buildPublicAppRedirectUrl,
} from "../lib/auth/confirmation-url.ts";

const [
  actions,
  loginPage,
  signupPage,
  passwordField,
  cockpitLayout,
  confirmationRoute,
  confirmationTemplate,
  deployment,
] = await Promise.all([
    readFile(new URL("../app/(auth)/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(auth)/signup/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/ui/password-field.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/(cockpit)/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/templates/confirm-signup.html", import.meta.url),
      "utf8",
    ),
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

test("auth callback — les redirections utilisent l'origine publique en production", () => {
  const input = {
    appUrl: "https://nepteo.bogasolution.com",
    requestOrigin: "https://0.0.0.0:3000",
    isProduction: true,
  };

  assert.equal(
    buildPublicAppRedirectUrl("/", input),
    "https://nepteo.bogasolution.com/",
  );
  assert.equal(
    buildPublicAppRedirectUrl("/login?error=invalide", input),
    "https://nepteo.bogasolution.com/login?error=invalide",
  );
  assert.throws(
    () => buildPublicAppRedirectUrl("/\\\\evil.example", input),
    /must be relative to the app origin/,
  );
  assert.match(confirmationRoute, /buildPublicAppRedirectUrl/);
  assert.equal(confirmationRoute.match(/return redirectTo\(/g)?.length, 3);
  assert.doesNotMatch(confirmationRoute, /request\.url/);
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
  const resendSection = signupPage.slice(signupPage.indexOf('id="resend-confirmation"'));
  assert.match(signupPage, /id="resend-confirmation"/);
  assert.match(signupPage, /action=\{resendConfirmation\}/);
  assert.match(signupPage, /Renvoyer le lien de confirmation/);
  assert.doesNotMatch(resendSection, /<PasswordField/);
  assert.doesNotMatch(resendSection, /name="password"/);
});

test("auth UI — connexion et inscription partagent un mot de passe affichable", () => {
  assert.match(loginPage, /<PasswordField autoComplete="current-password" \/>/);
  assert.match(loginPage, /name="email"[\s\S]*autoComplete="username"/);
  assert.match(signupPage, /<PasswordField[\s\S]*autoComplete="new-password"/);
  assert.match(passwordField, /useState\(false\)/);
  assert.match(passwordField, /type=\{visible \? "text" : "password"\}/);
  assert.match(passwordField, /type="button"/);
  assert.match(passwordField, /onClick=\{\(\) => setVisible\(\(current\) => !current\)\}/);
  assert.match(passwordField, /id="password"/);
  assert.match(passwordField, /aria-controls="password"/);
  assert.match(passwordField, /aria-describedby=\{hintId\}/);
  assert.match(passwordField, /Afficher le mot de passe/);
  assert.match(passwordField, /Masquer le mot de passe/);
  assert.match(passwordField, /autoComplete=\{autoComplete\}/);
  assert.match(passwordField, /name="password"/);
  assert.match(passwordField, /required/);
  assert.match(passwordField, /minLength=\{8\}/);
});

test("auth UI — la déconnexion reste visible et accessible sur mobile", () => {
  assert.match(cockpitLayout, /import \{ logout \} from "@\/app\/\(auth\)\/actions"/);
  assert.match(cockpitLayout, /<form action=\{logout\} className="lg:hidden">/);
  assert.match(cockpitLayout, /aria-label="Se déconnecter"/);
  assert.match(cockpitLayout, /title="Se déconnecter"/);
  assert.match(cockpitLayout, /Déconnexion/);
});

test("auth email — le modèle de confirmation reste français et conserve le callback", () => {
  assert.match(confirmationTemplate, /Confirme ton adresse email/);
  assert.equal(confirmationTemplate.match(/\{\{ \.ConfirmationURL \}\}/g)?.length, 2);
  assert.doesNotMatch(confirmationTemplate, /SiteURL|0\.0\.0\.0|Confirm your email/);
});
