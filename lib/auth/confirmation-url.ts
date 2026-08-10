type PublicAppUrlInput = {
  appUrl?: string;
  requestOrigin?: string | null;
  isProduction: boolean;
};

const DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const NON_PUBLIC_HOSTS = new Set([
  ...DEVELOPMENT_HOSTS,
  "0.0.0.0",
  "[::]",
]);

/**
 * Construit le callback des emails Auth depuis une origine publique explicite.
 *
 * En production, l'origine de la requête n'est jamais fiable : un reverse proxy
 * peut la remplacer par l'adresse d'écoute du conteneur (`0.0.0.0:3000`).
 * `APP_URL` est donc obligatoire et doit être une origine HTTPS publique.
 */
function publicAppOrigin({
  appUrl,
  requestOrigin,
  isProduction,
}: PublicAppUrlInput): string {
  const candidate = appUrl?.trim() || (!isProduction ? requestOrigin?.trim() : "");

  if (!candidate) {
    throw new Error("APP_URL is required in production");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL");
  }

  if (url.username || url.password) {
    throw new Error("APP_URL must not contain credentials");
  }

  const isLocalDevelopment =
    !isProduction &&
    url.protocol === "http:" &&
    DEVELOPMENT_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("APP_URL must use HTTPS in production");
  }

  if (isProduction && NON_PUBLIC_HOSTS.has(url.hostname)) {
    throw new Error("APP_URL must be publicly reachable in production");
  }

  return url.origin;
}

/** Construit une URL applicative absolue sans réutiliser l'origine interne du proxy. */
export function buildPublicAppRedirectUrl(
  path: string,
  input: PublicAppUrlInput,
): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Public app redirect path must be relative to the app origin");
  }

  const origin = publicAppOrigin(input);
  const redirect = new URL(path, `${origin}/`);

  if (redirect.origin !== origin) {
    throw new Error("Public app redirect path must stay on the app origin");
  }

  return redirect.toString();
}

export function buildConfirmationRedirectUrl(input: PublicAppUrlInput): string {
  return buildPublicAppRedirectUrl("/auth/confirm", input);
}
