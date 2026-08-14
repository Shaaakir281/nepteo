export const REQUIRED_SCHEMA_VERSION = 30;
export const READINESS_TIMEOUT_MS = 5_000;

export function supportsRequiredSchemaVersion(version: unknown): boolean {
  return (
    typeof version === "number" &&
    Number.isInteger(version) &&
    version >= REQUIRED_SCHEMA_VERSION
  );
}
