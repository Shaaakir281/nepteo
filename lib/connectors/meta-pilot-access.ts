export const META_PILOT_ACCESS_STATUSES = [
  "requested",
  "ready",
  "connected",
  "declined",
] as const;

export type MetaPilotAccessStatus =
  (typeof META_PILOT_ACCESS_STATUSES)[number];

export interface MetaPilotAccessRequest {
  id: string;
  facebook_email: string;
  facebook_profile_url: string | null;
  status: MetaPilotAccessStatus;
  requested_at: string;
  ready_at: string | null;
  connected_at: string | null;
}

export class MetaPilotAccessInputError extends Error {}

function normalizeFacebookProfileUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.length > 500) {
    throw new MetaPilotAccessInputError("Le lien de profil Facebook est trop long.");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new MetaPilotAccessInputError("Le lien de profil Facebook est invalide.");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) ||
    url.username ||
    url.password
  ) {
    throw new MetaPilotAccessInputError(
      "Utilisez un lien HTTPS vers un profil facebook.com.",
    );
  }
  url.hash = "";
  return url.toString();
}

export function parseMetaPilotAccessInput(input: {
  email: unknown;
  profileUrl: unknown;
}): { facebookEmail: string; facebookProfileUrl: string | null } {
  const facebookEmail = String(input.email ?? "").trim().toLowerCase();
  if (
    facebookEmail.length < 3 ||
    facebookEmail.length > 254 ||
    /[\r\n]/.test(facebookEmail) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(facebookEmail)
  ) {
    throw new MetaPilotAccessInputError(
      "Indiquez l’adresse e-mail associée à votre compte Facebook.",
    );
  }

  return {
    facebookEmail,
    facebookProfileUrl: normalizeFacebookProfileUrl(
      String(input.profileUrl ?? ""),
    ),
  };
}

export function readMetaPilotAccessRequest(
  value: unknown,
): MetaPilotAccessRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.facebook_email !== "string" ||
    typeof row.requested_at !== "string" ||
    !META_PILOT_ACCESS_STATUSES.includes(
      row.status as MetaPilotAccessStatus,
    )
  ) {
    return null;
  }
  return {
    id: row.id,
    facebook_email: row.facebook_email,
    facebook_profile_url:
      typeof row.facebook_profile_url === "string"
        ? row.facebook_profile_url
        : null,
    status: row.status as MetaPilotAccessStatus,
    requested_at: row.requested_at,
    ready_at: typeof row.ready_at === "string" ? row.ready_at : null,
    connected_at:
      typeof row.connected_at === "string" ? row.connected_at : null,
  };
}
