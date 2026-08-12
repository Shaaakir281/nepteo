import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [nextConfig, packageJson, packageLock] = await Promise.all([
  readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
]);

test("release sécurité — les protections navigateur couvrent toutes les routes", () => {
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "Referrer-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
  ]) {
    assert.match(nextConfig, new RegExp(header));
  }
  for (const directive of [
    "default-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ]) {
    assert.match(nextConfig, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(nextConfig, /source: "\/\(\.\*\)"/);
});

test("release sécurité — Next et les transitifs vulnérables sont verrouillés", () => {
  const manifest = JSON.parse(packageJson);
  const lock = JSON.parse(packageLock);
  assert.equal(manifest.dependencies.next, "^16.2.11");
  assert.equal(manifest.devDependencies["eslint-config-next"], "^16.2.11");
  assert.equal(manifest.dependencies.sharp, "0.35.3");
  assert.equal(manifest.overrides.nanoid, "3.3.18");
  assert.equal(manifest.overrides.postcss, "8.5.26");
  assert.equal(lock.packages["node_modules/next"].version, "16.2.11");
  assert.equal(lock.packages["node_modules/sharp"].version, "0.35.3");
});
