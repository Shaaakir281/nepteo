import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [actions, signupPage] = await Promise.all([
  readFile(new URL("../app/(auth)/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(auth)/signup/page.tsx", import.meta.url), "utf8"),
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
