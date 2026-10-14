// Clé publique des licences, intégrée à l'application de bureau (DER SPKI en base64).
// Elle n'a rien de secret : elle permet seulement de VÉRIFIER une licence signée par le site Spacora.
// Créée avec `npm run licence:cles` (la clé privée correspondante reste dans le .env du site).
// null : aucune clé encore créée, l'application refuse toute activation.
export const LICENCE_PUBLIC_KEY: string | null = null;
