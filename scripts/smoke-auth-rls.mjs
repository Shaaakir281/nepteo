import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const WRITE_ACK = "I_ACKNOWLEDGE_E2E_FIXTURE_WRITE";
const FIXTURE_ORG_PREFIX = "E2E_RLS_";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const usage = `
Smoke authentifié Supabase / RLS

Lecture seule :
  npm run smoke:rls -- --read-only

Smoke complet, avec sonde d'écriture éphémère :
  RLS_SMOKE_WRITE_PROBE=${WRITE_ACK} npm run smoke:rls

Variables requises :
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  RLS_SMOKE_EMAIL
  RLS_SMOKE_PASSWORD
  RLS_SMOKE_OWN_ORG_ID
  RLS_SMOKE_OTHER_ORG_ID

Le mode complet requiert aussi SUPABASE_SERVICE_ROLE_KEY. L'organisation propre
au compte de test doit avoir un nom commençant par "${FIXTURE_ORG_PREFIX}".
Le fichier .env.local est chargé par le script npm s'il existe.
`.trim();

function fail(message) {
  throw new Error(message);
}

function requiredEnv(name, { preserve = false } = {}) {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") fail(`Variable requise absente : ${name}`);
  return preserve ? raw : raw.trim();
}

function assertUuid(name, value) {
  if (!UUID_PATTERN.test(value)) fail(`${name} doit être un UUID valide.`);
}

function assertNoError(error, step) {
  if (error) {
    fail(`${step} : ${error.code ?? "erreur"} — ${error.message}`);
  }
}

function organizationFromRelation(value) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return;
  }
  const unknownArgs = args.filter((arg) => arg !== "--read-only");
  if (unknownArgs.length > 0) {
    fail(`Argument inconnu : ${unknownArgs.join(", ")}\n\n${usage}`);
  }
  const readOnly = args.includes("--read-only");

  if (!readOnly && process.env.RLS_SMOKE_WRITE_PROBE !== WRITE_ACK) {
    fail(
      `Sonde d'écriture non autorisée. Utilisez --read-only, ou posez ` +
        `RLS_SMOKE_WRITE_PROBE=${WRITE_ACK} sur une organisation de test dédiée.`,
    );
  }

  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requiredEnv("RLS_SMOKE_EMAIL");
  const password = requiredEnv("RLS_SMOKE_PASSWORD", { preserve: true });
  const ownOrgId = requiredEnv("RLS_SMOKE_OWN_ORG_ID");
  const otherOrgId = requiredEnv("RLS_SMOKE_OTHER_ORG_ID");
  assertUuid("RLS_SMOKE_OWN_ORG_ID", ownOrgId);
  assertUuid("RLS_SMOKE_OTHER_ORG_ID", otherOrgId);
  if (ownOrgId === otherOrgId) {
    fail("Les organisations propre et tierce doivent être différentes.");
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: auth, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });
  assertNoError(authError, "Authentification");
  if (!auth.user || !auth.session) fail("Authentification sans utilisateur/session.");
  console.log("✓ Authentification par mot de passe");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id, user_id, role, organizations(id, name)")
    .eq("organization_id", ownOrgId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  assertNoError(membershipError, "Lecture du membership");
  if (!membership) fail("Membership attendu introuvable.");
  if (membership.role !== "lecture") {
    fail(`Le compte de smoke doit avoir le rôle lecture, reçu : ${membership.role}.`);
  }
  const relatedOrg = organizationFromRelation(membership.organizations);
  if (relatedOrg?.id !== ownOrgId) {
    fail("La relation membership → organisation propre est absente ou incohérente.");
  }
  console.log("✓ Membership trouvé avec le rôle lecture");

  const { data: ownOrg, error: ownOrgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", ownOrgId)
    .maybeSingle();
  assertNoError(ownOrgError, "Lecture de l'organisation propre");
  if (!ownOrg || ownOrg.id !== ownOrgId) {
    fail("L'organisation propre n'est pas lisible.");
  }
  console.log("✓ Organisation propre lisible");

  const { data: leakedOrg, error: crossOrgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", otherOrgId)
    .maybeSingle();
  assertNoError(crossOrgError, "Test d'isolement cross-org");
  if (leakedOrg) {
    fail("ÉCHEC RLS : l'organisation tierce est lisible par le compte de test.");
  }
  console.log("✓ Organisation tierce invisible");

  if (readOnly) {
    console.log(
      "△ Mode lecture seule : le refus d'écriture du rôle lecture n'a pas été sondé.",
    );
    return;
  }

  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  // Le service role ne sert qu'aux préconditions et au nettoyage exact de la
  // ligne éphémère. La tentative contrôlée est toujours faite avec le JWT lecture.
  const { data: fixtureOrgs, error: fixtureOrgsError } = await admin
    .from("organizations")
    .select("id, name")
    .in("id", [ownOrgId, otherOrgId]);
  assertNoError(fixtureOrgsError, "Préflight des organisations E2E");
  if ((fixtureOrgs ?? []).length !== 2) {
    fail("Les deux organisations E2E doivent exister réellement.");
  }
  const adminOwnOrg = fixtureOrgs.find((org) => org.id === ownOrgId);
  if (!adminOwnOrg?.name?.startsWith(FIXTURE_ORG_PREFIX)) {
    fail(
      `La sonde d'écriture est limitée aux organisations nommées ` +
        `${FIXTURE_ORG_PREFIX}*.`,
    );
  }

  const fixtureId = randomUUID();
  const fixtureSection = `__e2e_rls_smoke__${fixtureId}`;
  const { data: collision, error: collisionError } = await admin
    .from("company_memory")
    .select("id")
    .eq("id", fixtureId)
    .maybeSingle();
  assertNoError(collisionError, "Préflight de l'identifiant de fixture");
  if (collision) fail("Collision UUID inattendue : sonde annulée.");

  let writeResult = null;
  let writeFailure = null;
  let cleanupFailure = null;
  try {
    writeResult = await supabase
      .from("company_memory")
      .insert({
        id: fixtureId,
        organization_id: ownOrgId,
        section: fixtureSection,
        content: {
          created_by: "smoke-auth-rls",
          fixture_id: fixtureId,
        },
      })
      .select("id")
      .maybeSingle();
  } catch (error) {
    writeFailure = error;
  } finally {
    const { error: cleanupError } = await admin
      .from("company_memory")
      .delete()
      .eq("id", fixtureId)
      .eq("organization_id", ownOrgId);
    if (cleanupError) cleanupFailure = cleanupError;
  }

  if (cleanupFailure) {
    fail(
      `NETTOYAGE ÉCHOUÉ pour la fixture exacte ${fixtureId} : ` +
        cleanupFailure.message,
    );
  }
  const { count: remaining, error: remainingError } = await admin
    .from("company_memory")
    .select("id", { count: "exact", head: true })
    .eq("id", fixtureId)
    .eq("organization_id", ownOrgId);
  assertNoError(remainingError, "Vérification du nettoyage");
  if (remaining !== 0) {
    fail(`La fixture exacte ${fixtureId} existe encore après nettoyage.`);
  }

  if (writeFailure) {
    fail(
      `Sonde d'écriture non concluante : ${
        writeFailure instanceof Error ? writeFailure.message : String(writeFailure)
      }`,
    );
  }
  if (!writeResult) fail("Sonde d'écriture sans résultat exploitable.");
  if (!writeResult.error) {
    fail(
      "ÉCHEC RLS : le rôle lecture a pu créer une ligne company_memory. " +
        "La fixture a été supprimée.",
    );
  }
  if (writeResult.error.code !== "42501") {
    fail(
      `Sonde d'écriture non concluante : ${writeResult.error.code ?? "erreur"} — ` +
        writeResult.error.message,
    );
  }
  console.log("✓ Écriture company_memory refusée au rôle lecture (RLS 42501)");
  console.log("✓ Fixture éphémère absente après nettoyage exact");
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
