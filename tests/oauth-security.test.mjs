import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildConnectorPublicUrl,
  createOAuthState,
  oauthStateCookieOptions,
  verifyOAuthState,
} from "../lib/connectors/oauth-security.ts";

const secret = Buffer.alloc(32, 7).toString("base64");
const context = {
  provider: "google_sheets",
  userId: "user-a",
  orgId: "org-a",
  secret,
};

const routePaths = [
  "../app/api/connectors/google_sheets/authorize/route.ts",
  "../app/api/connectors/google_sheets/callback/route.ts",
  "../app/api/connectors/notion/authorize/route.ts",
  "../app/api/connectors/notion/callback/route.ts",
  "../app/api/connectors/meta_ads/authorize/route.ts",
  "../app/api/connectors/meta_ads/callback/route.ts",
];

const routes = await Promise.all(
  routePaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

test("OAuth — le state est lié au navigateur, au provider, à l'utilisateur et au tenant", () => {
  const state = createOAuthState(context);
  assert.equal(verifyOAuthState(state, state, context), true);
  assert.equal(verifyOAuthState(state, undefined, context), false);
  assert.equal(verifyOAuthState(state, `${state}x`, context), false);
  assert.equal(
    verifyOAuthState(state, state, { ...context, userId: "user-b" }),
    false,
  );
  assert.equal(
    verifyOAuthState(state, state, { ...context, orgId: "org-b" }),
    false,
  );
  assert.equal(
    verifyOAuthState(state, state, { ...context, provider: "notion" }),
    false,
  );
});

test("OAuth — toute altération du state échoue fermé", () => {
  const state = createOAuthState(context);
  const parts = state.split(".");
  parts[2] = `${parts[2].startsWith("A") ? "B" : "A"}${parts[2].slice(1)}`;
  const tampered = parts.join(".");
  assert.equal(verifyOAuthState(tampered, tampered, context), false);
  assert.equal(verifyOAuthState("v1.incomplet", "v1.incomplet", context), false);
});

test("OAuth — APP_URL gagne toujours sur l'origine interne du conteneur", () => {
  assert.equal(
    buildConnectorPublicUrl("/api/connectors/google_sheets/callback", {
      appUrl: "https://nepteo.bogasolution.com",
      requestUrl: "http://0.0.0.0:3000/api/connectors/google_sheets/authorize",
      isProduction: true,
    }),
    "https://nepteo.bogasolution.com/api/connectors/google_sheets/callback",
  );
  assert.throws(
    () =>
      buildConnectorPublicUrl("/api/connectors/notion/callback", {
        requestUrl: "http://0.0.0.0:3000/api/connectors/notion/authorize",
        isProduction: true,
      }),
    /APP_URL is required/,
  );
});

test("OAuth — les cookies de state sont HttpOnly, SameSite et Secure en production", () => {
  assert.deepEqual(oauthStateCookieOptions(true), {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  assert.equal(oauthStateCookieOptions(false).secure, false);
});

test("OAuth — les six routes partagent l'origine publique et le state signé", () => {
  for (const route of routes) {
    assert.match(route, /buildConnectorPublicUrl/);
    assert.doesNotMatch(route, /new URL\(\s*["'`]\//);
  }
  for (const route of [routes[0], routes[2], routes[4]]) {
    assert.match(route, /createOAuthState/);
    assert.match(route, /oauthStateCookieOptions\(isProduction\)/);
  }
  for (const route of [routes[1], routes[3], routes[5]]) {
    assert.match(route, /verifyOAuthState/);
    assert.match(route, /maxAge: 0/);
  }
});
