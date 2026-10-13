// Mode « site vitrine statique » : pages exportées en simples fichiers (hébergement web sans le service).
// Activé à la construction (STATIC_SITE=1, voir scripts/export-vitrine.mjs) ; sans effet en temps normal.

export const staticSite = process.env.STATIC_SITE === "1";

/** Adresse de contact affichée par le site vitrine statique (boîte e-mail du domaine). */
export const contactEmail = process.env.CONTACT_EMAIL ?? "contact@spacora.tech";

/** Destination des boutons « Essai gratuit » : l'inscription, ou un e-mail tant que le service n'est pas en ligne. */
export function signupHref(subject: string): string {
  return staticSite
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`
    : "/inscription";
}
