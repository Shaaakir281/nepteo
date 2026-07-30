import assert from "node:assert/strict";
import test from "node:test";
import {
  AMBIGUOUS_MEMBERSHIP_ERROR,
  resolveSingleMembership,
} from "../lib/auth/membership-rules.ts";

test("membership courant - aucun membership retourne null", () => {
  assert.equal(resolveSingleMembership([]), null);
});

test("membership courant - un membership est conservé exactement", () => {
  const membership = { organization_id: "org-1", role: "admin" };

  assert.equal(resolveSingleMembership([membership]), membership);
});

test("membership courant - plusieurs organisations échouent sans en choisir une", () => {
  assert.throws(
    () =>
      resolveSingleMembership([
        { organization_id: "org-1" },
        { organization_id: "org-2" },
      ]),
    {
      message: AMBIGUOUS_MEMBERSHIP_ERROR,
    },
  );
});
