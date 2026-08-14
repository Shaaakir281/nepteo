import type { BudgetResultsAttribution, BudgetResultsPeriod } from "./types.ts";

const DAY_MS = 86_400_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function nonEmptyText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

export function isoDate(value: unknown): string | null {
  const normalized = nonEmptyText(value, 10);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

export function isoTimestamp(value: unknown): string | null {
  const normalized = nonEmptyText(value, 50);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function currency(value: unknown): string | null {
  const normalized = nonEmptyText(value, 3)?.toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export function timezone(value: unknown): string | null {
  const normalized = nonEmptyText(value, 80);
  if (!normalized) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: normalized }).format(new Date(0));
    return normalized;
  } catch {
    return null;
  }
}

export function nonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function scaledInteger(value: unknown, scale: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`);
  if (!pattern.test(raw)) return null;
  const parsed = Number(raw);
  const scaled = Math.round(parsed * 10 ** scale);
  return Number.isFinite(parsed) && Number.isSafeInteger(scaled) ? scaled : null;
}

export function attribution(
  modelValue: unknown,
  windowsValue: unknown,
): BudgetResultsAttribution | null {
  const model = nonEmptyText(modelValue, 80);
  if (!model || !Array.isArray(windowsValue) || windowsValue.length === 0) return null;
  const windows = windowsValue.map((item) => nonEmptyText(item, 40));
  if (windows.some((item) => item === null)) return null;
  const normalized = windows as string[];
  if (new Set(normalized).size !== normalized.length) return null;
  return { model, windows: [...normalized] };
}

export function sameAttribution(
  left: BudgetResultsAttribution,
  right: BudgetResultsAttribution,
): boolean {
  return left.model === right.model &&
    left.windows.length === right.windows.length &&
    left.windows.every((value, index) => value === right.windows[index]);
}

export function identityMatches(
  row: Record<string, unknown>,
  organizationId: string,
  accountId: string,
): boolean {
  return row.organization_id === organizationId &&
    row.provider === "meta_ads" &&
    row.account_id === accountId;
}

export function dateInTimezone(value: Date, accountTimezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: accountTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function periodLength(period: BudgetResultsPeriod): number {
  return (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) /
    DAY_MS + 1;
}
