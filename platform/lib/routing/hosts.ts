// Séparation du site vitrine (www) et du service (app) sur deux noms de domaine. Code pur, testé.
// Sans les deux adresses configurées (développement, installation sur un seul domaine), rien n'est redirigé.

/** Pages du site vitrine : servies sur www ; sur app, l'accueil mène au tableau de bord. */
const SITE_PAGES = new Set(["/"]);
/** Pages légales : servies sur les deux domaines (liées depuis l'inscription et le service). */
const SHARED_PAGES = new Set([
  "/mentions-legales",
  "/cgu",
  "/cgv",
  "/confidentialite",
]);

export interface HostConfig {
  /** URL publique du site vitrine (SITE_URL), ex. https://www.isoplan.fr */
  siteUrl?: string;
  /** URL publique du service (AUTH_URL), ex. https://app.isoplan.fr */
  appUrl?: string;
}

function parse(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Adresse vers laquelle rediriger la requête, ou null pour la servir telle quelle.
 * - www : accueil et pages légales ; toute autre page (connexion, inscription, service) part sur app.
 * - app : l'accueil mène au tableau de bord, ou directement à la connexion sans session.
 * - autre domaine (vérification de santé, adresse IP) : rien n'est redirigé.
 */
export function hostRedirect(
  request: {
    host: string | null;
    pathname: string;
    search: string;
    /** Cookie de session présent (sa validité est vérifiée ensuite par la page). */
    signedIn?: boolean;
  },
  config: HostConfig,
): string | null {
  const site = parse(config.siteUrl);
  const app = parse(config.appUrl);
  if (!site || !app || site.host === app.host || !request.host) return null;
  const host = request.host.toLowerCase();
  if (host === app.host)
    return SITE_PAGES.has(request.pathname)
      ? `${app.origin}${request.signedIn ? "/tableau-de-bord" : "/login"}`
      : null;
  if (host === site.host) {
    if (SITE_PAGES.has(request.pathname) || SHARED_PAGES.has(request.pathname))
      return null;
    return `${app.origin}${request.pathname}${request.search}`;
  }
  return null;
}

/** Cookie de session Auth.js (nom simple ou découpé en morceaux, préfixé en HTTPS). */
export function isSessionCookieName(name: string): boolean {
  return /^(__Secure-)?authjs\.session-token(\.\d+)?$/.test(name);
}
