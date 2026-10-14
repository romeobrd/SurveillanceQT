// Politique de sécurité du contenu (CSP) : fonction pure, testée unitairement, posée par next.config.ts.
// Aucune origine externe n'est autorisée : ni script, ni police, ni traceur tiers (règle RGPD du projet).
//
// Pourquoi pas de nonce : l'application utilise cacheComponents (prérendu partiel). Le « shell » statique
// est généré à la compilation, sans requête, donc sans nonce possible (incompatibilité documentée par Next.js).
// Le mode SRI expérimental ne couvre pas les scripts en ligne propres à Next.js. 'unsafe-inline' est donc
// conservé pour les scripts ; le reste de la politique (origines, objets, cadres, formulaires, base) reste strict.
// Défense complémentaire : React échappe tout contenu et le projet n'utilise aucun dangerouslySetInnerHTML.

export interface CspOptions {
  /** Mode développement : React utilise eval pour reconstituer les piles d'erreur. */
  dev?: boolean;
  /** Application de bureau, servie en http sur 127.0.0.1 : pas de passage forcé en https. */
  local?: boolean;
}

export function buildCsp({
  dev = false,
  local = false,
}: CspOptions = {}): string {
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ...(dev || local
      ? []
      : [["upgrade-insecure-requests", []] as [string, string[]]]),
  ];
  return directives
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}
