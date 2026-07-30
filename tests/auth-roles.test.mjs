import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_ROLES,
  capabilitiesForRole,
  isCommercialSafeActionKind,
  isFinancialActionKind,
} from "../lib/auth/roles.ts";

test("matrice des rôles — le commercial est sans finances ni mutation", () => {
  assert.deepEqual(capabilitiesForRole("commercial"), {
    canEdit: false,
    canViewFinancials: false,
    canManageCampaigns: false,
  });
});

test("matrice des rôles — lecture voit les finances mais ne mute rien", () => {
  assert.deepEqual(capabilitiesForRole("lecture"), {
    canEdit: false,
    canViewFinancials: true,
    canManageCampaigns: false,
  });
});

test("matrice des rôles — seuls les éditeurs financiers gèrent les campagnes", () => {
  for (const role of APP_ROLES) {
    const capabilities = capabilitiesForRole(role);
    if (["admin", "marketing", "direction"].includes(role)) {
      assert.deepEqual(capabilities, {
        canEdit: true,
        canViewFinancials: true,
        canManageCampaigns: true,
      });
    } else {
      assert.equal(capabilities.canManageCampaigns, false);
    }

    assert.equal(
      capabilities.canManageCampaigns && !capabilities.canViewFinancials,
      false,
      `${role} ne peut pas gérer une campagne sans voir ses finances`,
    );
  }
});

test("matrice des rôles — un rôle inconnu échoue fermé", () => {
  assert.deepEqual(capabilitiesForRole("owner"), {
    canEdit: false,
    canViewFinancials: false,
    canManageCampaigns: false,
  });
});

test("classification financière — campagnes préparées et analyses ads", () => {
  assert.equal(isFinancialActionKind("launch_campaign"), true);
  assert.equal(isFinancialActionKind("ads_pause_meta-123"), true);
  assert.equal(isFinancialActionKind("followup_stage_prospect"), false);
  assert.equal(isFinancialActionKind(null), false);
});

test("actions visibles au commercial — allowlist fail-closed", () => {
  for (const kind of [
    "complete_missing_emails",
    "relaunch_priority",
    "relaunch_dormant",
    "relaunch_stage_proposition_envoyee",
    "classify_unlabeled",
    "dedupe_emails",
    "complete_missing_company",
  ]) {
    assert.equal(isCommercialSafeActionKind(kind), true, kind);
  }
  assert.equal(isCommercialSafeActionKind("launch_campaign"), false);
  assert.equal(isCommercialSafeActionKind("ads_pause_1"), false);
  assert.equal(isCommercialSafeActionKind("future_action"), false);
  assert.equal(isCommercialSafeActionKind(null), false);
});
