import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { buildPublicAppRedirectUrl } from "../auth/confirmation-url.ts";
import type { OauthProvider } from "./common.ts";

const OAUTH_STATE_VERSION = "v1";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

const COOKIE_NAMES: Record<OauthProvider, string> = {
  google_sheets: "oauth_state_google",
  notion: "oauth_state_notion",
  meta_ads: "oauth_state_meta_ads",
};

type OAuthStateContext = {
  provider: OauthProvider;
  userId: string;
  orgId: string;
  secret?: string;
};

type ConnectorPublicUrlInput = {
  appUrl?: string;
  requestUrl: string;
  isProduction: boolean;
};

function signingKey(secret = process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY): Buffer {
  if (!secret) throw new Error("CONNECTOR_TOKEN_ENCRYPTION_KEY manquante");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error("CONNECTOR_TOKEN_ENCRYPTION_KEY : 32 octets base64 attendus");
  }
  return key;
}

function signature(nonce: string, context: OAuthStateContext): Buffer {
  return createHmac("sha256", signingKey(context.secret))
    .update(
      [
        "nepteo-oauth-state",
        OAUTH_STATE_VERSION,
        context.provider,
        context.userId,
        context.orgId,
        nonce,
      ].join("\0"),
      "utf8",
    )
    .digest();
}

/**
 * Le state reste opaque pour le fournisseur tout en étant lié à l'utilisateur,
 * à l'organisation et au provider qui ont réellement démarré le flux.
 */
export function createOAuthState(context: OAuthStateContext): string {
  const nonce = randomBytes(32).toString("base64url");
  const mac = signature(nonce, context).toString("base64url");
  return `${OAUTH_STATE_VERSION}.${nonce}.${mac}`;
}

export function verifyOAuthState(
  state: string | null,
  cookieState: string | undefined,
  context: OAuthStateContext,
): boolean {
  if (!state || !cookieState || state !== cookieState || state.length > 160) {
    return false;
  }
  const [version, nonce, encodedMac, extra] = state.split(".");
  if (
    version !== OAUTH_STATE_VERSION ||
    !nonce ||
    !encodedMac ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(encodedMac)
  ) {
    return false;
  }

  try {
    const actual = Buffer.from(encodedMac, "base64url");
    const expected = signature(nonce, context);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function oauthStateCookieName(provider: OauthProvider): string {
  return COOKIE_NAMES[provider];
}

export function oauthStateCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction,
  };
}

/** Ignore toujours l'origine interne du conteneur en production. */
export function buildConnectorPublicUrl(
  path: string,
  input: ConnectorPublicUrlInput,
): string {
  return buildPublicAppRedirectUrl(path, {
    appUrl: input.appUrl,
    requestOrigin: new URL(input.requestUrl).origin,
    isProduction: input.isProduction,
  });
}
