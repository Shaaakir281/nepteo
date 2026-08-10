export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function completeRead<
  T extends { data: unknown[] | null; error: unknown; count: number | null },
>(
  result: T,
  limit: number,
): result is T & { data: NonNullable<T["data"]>; error: null; count: number } {
  return (
    result.error === null &&
    Array.isArray(result.data) &&
    result.count !== null &&
    result.count <= limit &&
    result.count === result.data.length
  );
}

export function scalarSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}
