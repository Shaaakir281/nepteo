export const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
export const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function isoDaysAgo(now: Date, daysAgo: number): string {
  const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  value.setUTCDate(value.getUTCDate() - daysAgo);
  return value.toISOString().slice(0, 10);
}

export function formatDate(value: string): string {
  return day.format(new Date(`${value}T00:00:00.000Z`));
}

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}

export function formatCtr(value: number): string {
  return `${decimal.format(value * 100)} %`;
}
