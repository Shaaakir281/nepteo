export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function campaignProjectionAvailable(
  payload?: Record<string, unknown> | null,
): boolean {
  const projection = asRecord(asRecord(payload)?.projection);
  return projection?.status === "available" && asRecord(projection.projection) !== null;
}

export function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

export function firstStringList(...values: unknown[]): string[] {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (Array.isArray(value)) {
      const strings = value.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      );
      if (strings.length > 0) return strings.map((item) => item.trim());
    }
  }
  return [];
}
