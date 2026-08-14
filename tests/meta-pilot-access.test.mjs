import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MetaPilotAccessInputError,
  parseMetaPilotAccessInput,
  readMetaPilotAccessRequest,
} from "../lib/connectors/meta-pilot-access.ts";

const migration = await readFile(
  new URL("../supabase/migrations/0030_meta_ads_pilot_access.sql", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../app/(cockpit)/connecteurs/[provider]/page.tsx", import.meta.url),
  "utf8",
);
const section = await readFile(
  new URL(
    "../app/(cockpit)/connecteurs/[provider]/_components/meta-pilot-access-section.tsx",
    import.meta.url,
  ),
  "utf8",
);
const actions = await readFile(
  new URL("../app/(cockpit)/connecteurs/[provider]/actions.ts", import.meta.url),
  "utf8",
);
const callback = await readFile(
  new URL("../app/api/connectors/meta_ads/callback/route.ts", import.meta.url),
  "utf8",
);
const connectorCard = await readFile(
  new URL(
    "../app/(cockpit)/connecteurs/_components/connector-card.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("META-PILOT — l’entrée normalise l’e-mail et borne le lien Facebook", () => {
  assert.deepEqual(
    parseMetaPilotAccessInput({
      email: "  Testeur@Example.COM ",
      profileUrl: "https://www.facebook.com/testeur#contact",
    }),
    {
      facebookEmail: "testeur@example.com",
      facebookProfileUrl: "https://www.facebook.com/testeur",
    },
  );
  assert.deepEqual(
    parseMetaPilotAccessInput({ email: "testeur@example.com", profileUrl: "" }),
    { facebookEmail: "testeur@example.com", facebookProfileUrl: null },
  );
  for (const input of [
    { email: "pas-un-email", profileUrl: "" },
    { email: "testeur@example.com", profileUrl: "http://facebook.com/testeur" },
    { email: "testeur@example.com", profileUrl: "https://example.com/testeur" },
    { email: "testeur@example.com", profileUrl: "https://facebook.com.evil.test/testeur" },
  ]) {
    assert.throws(() => parseMetaPilotAccessInput(input), MetaPilotAccessInputError);
  }
});

test("META-PILOT — seules les demandes structurées sont présentées", () => {
  assert.equal(readMetaPilotAccessRequest({ status: "requested" }), null);
  assert.equal(readMetaPilotAccessRequest({
    id: "request-1",
    facebook_email: "testeur@example.com",
    facebook_profile_url: null,
    status: "unexpected",
    requested_at: "2026-08-14T10:00:00Z",
  }), null);
  assert.equal(readMetaPilotAccessRequest({
    id: "request-1",
    facebook_email: "testeur@example.com",
    facebook_profile_url: null,
    status: "ready",
    requested_at: "2026-08-14T10:00:00Z",
    ready_at: "2026-08-14T11:00:00Z",
  })?.status, "ready");
});

test("META-PILOT — stockage tenant/utilisateur, RLS et RPC service-role", () => {
  assert.match(migration, /version >= 29[\s\S]*requires schema version 29/i);
  assert.match(migration, /organization_id uuid not null[\s\S]*requested_by uuid not null/i);
  assert.match(migration, /unique \(organization_id, requested_by\)/i);
  assert.match(
    migration,
    /create policy meta_ads_pilot_access_own_select[\s\S]*requested_by = auth\.uid\(\)[\s\S]*has_org_role/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.meta_ads_pilot_access_requests[\s\S]*authenticated/i,
  );
  assert.match(
    migration,
    /grant select on table public\.meta_ads_pilot_access_requests to authenticated/i,
  );
  for (const fn of [
    "request_meta_ads_pilot_access",
    "mark_meta_ads_pilot_access_ready",
    "mark_meta_ads_pilot_access_connected",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke execute on function public\\.${fn}[\\s\\S]*authenticated`, "i"),
    );
  }
  assert.match(migration, /set version = greatest\(version, 30\)/i);
});

test("META-PILOT — la validation reste explicitement manuelle et traçable", () => {
  assert.match(migration, /validation du testeur reste manuelle/i);
  assert.match(migration, /mark_meta_ads_pilot_access_ready/i);
  assert.match(migration, /meta_ads_pilot_access_requested/i);
  assert.match(migration, /meta_ads_pilot_access_ready/i);
  assert.match(migration, /meta_ads_pilot_access_connected/i);
  assert.doesNotMatch(migration, /http_request|net\.http|graph\.facebook|ads_management/i);
});

test("META-PILOT — l’UX ne demande aucun secret et permet la reprise OAuth", () => {
  assert.match(connectorCard, /tool\.provider === "meta_ads"[\s\S]*href=\{detailsHref\}/);
  assert.match(page, /meta_ads_pilot_access_requests/);
  assert.match(page, /requested_by/);
  assert.match(actions, /request_meta_ads_pilot_access/);
  assert.match(section, /Adresse e-mail associée au compte Facebook/);
  assert.match(section, /Lien du profil Facebook/);
  assert.match(section, /demande d’accès a bien été reçue/);
  assert.match(section, /canEdit && pending/);
  assert.match(section, /canEdit && ready/);
  assert.match(section, /connexion Meta sera alors déverrouillée/);
  assert.match(section, /Finaliser la connexion Meta/);
  assert.match(section, /mot de passe Facebook/);
  assert.match(section, /ni jeton Meta/);
  assert.match(section, /ni identifiant[\s\S]*ni secret/);
  assert.match(section, /permission <code>ads_read<\/code>/);
  assert.doesNotMatch(section, /name="(?:password|token|app_id|app_secret)"/i);
  assert.match(callback, /mark_meta_ads_pilot_access_connected/);
  assert.match(callback, /demandez d’abord l’accès pilote/);
});
