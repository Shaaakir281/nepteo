/**
 * État de cycle de vie commun aux connecteurs à lecture seule.
 *
 * Les jetons restent exclusivement dans `encrypted_credentials`. Cette vue
 * expurgée ne conserve que les preuves opérationnelles nécessaires à l'UI et
 * au journal : jamais de jeton, de réponse fournisseur brute ou de données de
 * prospects.
 */

export type ConnectorReadStatus = "ok" | "error";

export interface ConnectorLifecycle {
  version: 1;
  consented_at: string;
  granted_scopes: string[];
  verified_source_at?: string;
  last_read_at?: string;
  last_read_status?: ConnectorReadStatus;
  last_error_code?: "read_failed";
  paused_at?: string;
}

type Config = Record<string, unknown>;

function iso(value: unknown): string | undefined {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return value;
}

function scopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (scope): scope is string =>
      typeof scope === "string" && scope.length > 0 && scope.length <= 160,
  );
}

/** Lit l'état sans faire confiance à des valeurs JSON non structurées. */
export function readConnectorLifecycle(config: unknown): ConnectorLifecycle | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const candidate = (config as Config).connection;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const value = candidate as Config;
  const consentedAt = iso(value.consented_at);
  if (value.version !== 1 || !consentedAt) return null;

  const lastReadStatus =
    value.last_read_status === "ok" || value.last_read_status === "error"
      ? value.last_read_status
      : undefined;
  const lastErrorCode =
    lastReadStatus === "error" && value.last_error_code === "read_failed"
      ? "read_failed"
      : undefined;

  return {
    version: 1,
    consented_at: consentedAt,
    granted_scopes: scopes(value.granted_scopes),
    verified_source_at: iso(value.verified_source_at),
    last_read_at: iso(value.last_read_at),
    last_read_status: lastReadStatus,
    last_error_code: lastErrorCode,
    paused_at: iso(value.paused_at),
  };
}

function withLifecycle(config: Config, lifecycle: ConnectorLifecycle): Config {
  return { ...config, connection: lifecycle };
}

export function recordConsent(
  config: Config,
  grantedScopes: readonly string[],
  at: string,
): Config {
  return withLifecycle(config, {
    version: 1,
    consented_at: at,
    granted_scopes: [...grantedScopes],
  });
}

export function recordReadSuccess(config: Config, at: string): Config {
  const lifecycle = readConnectorLifecycle(config);
  if (!lifecycle) throw new Error("Consentement connecteur absent.");
  return withLifecycle(config, {
    ...lifecycle,
    verified_source_at: lifecycle.verified_source_at ?? at,
    last_read_at: at,
    last_read_status: "ok",
    last_error_code: undefined,
  });
}

export function recordReadFailure(config: Config, at: string): Config {
  const lifecycle = readConnectorLifecycle(config);
  if (!lifecycle) return config;
  return withLifecycle(config, {
    ...lifecycle,
    last_read_at: at,
    last_read_status: "error",
    last_error_code: "read_failed",
  });
}

export function setConnectorPaused(
  config: Config,
  paused: boolean,
  at: string,
): Config {
  const lifecycle = readConnectorLifecycle(config);
  if (!lifecycle) throw new Error("Consentement connecteur absent.");
  return withLifecycle(config, {
    ...lifecycle,
    paused_at: paused ? at : undefined,
  });
}

export function hasConnectorConsent(config: unknown): boolean {
  return readConnectorLifecycle(config) !== null;
}

export function isConnectorPaused(config: unknown): boolean {
  return Boolean(readConnectorLifecycle(config)?.paused_at);
}

export function connectionPresentation(
  status: string,
  config: unknown,
): "available" | "configured" | "connected" | "error" | "paused" {
  const lifecycle = readConnectorLifecycle(config);
  if (!lifecycle) return status === "connected" ? "connected" : "available";
  if (lifecycle.paused_at) return "paused";
  if (lifecycle.last_read_status === "error") return "error";
  if (status === "connected" && lifecycle.verified_source_at) return "connected";
  return "configured";
}
