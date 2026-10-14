// Édition de Spacora servie par ce processus (variable SPACORA_EDITION, lue au démarrage) :
// - saas : service complet en ligne (site, inscription, application dans le navigateur) — par défaut ;
// - boutique : site + espace client (inscription, abonnement, téléchargement de l'application de bureau) ;
// - desktop : application de bureau (.exe) : service seul, données sur le PC, activée par un abonnement.

export const EDITIONS = ["saas", "boutique", "desktop"] as const;
export type Edition = (typeof EDITIONS)[number];

export function edition(): Edition {
  const value = process.env.SPACORA_EDITION;
  return (EDITIONS as readonly string[]).includes(value ?? "")
    ? (value as Edition)
    : "saas";
}

/** Page d'arrivée après connexion ou inscription. */
export function homeAfterLogin(): string {
  return edition() === "boutique" ? "/espace-client" : "/tableau-de-bord";
}

/** Adresse du site vitrine depuis le service : site public de Spacora pour l'application de bureau. */
export function siteHomeHref(): string {
  if (edition() === "desktop")
    return process.env.SPACORA_SITE_URL ?? "https://www.spacora.tech";
  return process.env.SITE_URL ?? "/";
}
