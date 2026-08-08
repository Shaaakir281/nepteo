import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONNECTOR_CAPABILITIES,
  CONNECTOR_CATALOG,
  isRequestableConnector,
} from "../lib/connectors.ts";
import {
  connectionPresentation,
  hasConnectorConsent,
  isConnectorPaused,
  recordConsent,
  recordReadFailure,
  recordReadSuccess,
  setConnectorPaused,
} from "../lib/connectors/lifecycle.ts";

const at = "2026-08-08T10:00:00.000Z";

test("CONN-1 — chaque carte a une capacité explicite, lecture seule", () => {
  const providers = CONNECTOR_CATALOG.flatMap((group) =>
    group.tools.map((tool) => tool.provider),
  );
  assert.equal(providers.length, 22);
  assert.deepEqual(Object.keys(CONNECTOR_CAPABILITIES).sort(), providers.sort());
  assert.equal(
    providers.filter((provider) => CONNECTOR_CAPABILITIES[provider].write).length,
    0,
  );
  assert.deepEqual(
    providers.filter((provider) => !isRequestableConnector(provider)).sort(),
    ["csv", "google_sheets", "meta_ads", "notion"],
  );
});

test("CONN-1 — consentement, lecture, pause et erreur restent honnêtes", () => {
  const consented = recordConsent({}, ["spreadsheets.readonly"], at);
  assert.equal(hasConnectorConsent(consented), true);
  assert.equal(connectionPresentation("disconnected", consented), "configured");

  const verified = recordReadSuccess(consented, at);
  assert.equal(connectionPresentation("connected", verified), "connected");

  const paused = setConnectorPaused(verified, true, at);
  assert.equal(isConnectorPaused(paused), true);
  assert.equal(connectionPresentation("connected", paused), "paused");

  const resumed = setConnectorPaused(paused, false, at);
  const failed = recordReadFailure(resumed, at);
  assert.equal(connectionPresentation("connected", failed), "error");
  assert.equal(failed.connection.last_error_code, "read_failed");
  assert.equal(JSON.stringify(failed).includes("access_token"), false);
});

test("CONN-1 — une demande de catalogue est refusée pour un parcours réel", async () => {
  const [actions, sync, store] = await Promise.all([
    readFile(new URL("../app/(cockpit)/connecteurs/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors/store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /isRequestableConnector\(tool\.provider\)/);
  assert.match(sync, /isConnectorPaused\(c\.config\)/);
  assert.match(sync, /event: "connector_sync_failed"/);
  assert.match(store, /status: "disconnected"/);
  assert.match(store, /event: "connector_authorized"/);
});
