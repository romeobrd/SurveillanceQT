// Identifiants des éléments et zones créés dans l'éditeur.
// Aléatoires et jamais réutilisés : un identifiant supprimé ne peut pas désigner un autre objet
// (le serveur s'appuie sur ces identifiants pour conserver attributions, stock et matériel).

export type IdFactory = (prefix: "e" | "z") => string;

function randomSuffix(): string {
  const values = new Uint32Array(2);
  globalThis.crypto.getRandomValues(values);
  return `${values[0].toString(36)}${values[1].toString(36)}`;
}

export const randomId: IdFactory = (prefix) => `${prefix}-${randomSuffix()}`;

/** Identifiants déterministes pour les tests. */
export function sequentialIds(): IdFactory {
  let n = 0;
  return (prefix) => `${prefix}-test${++n}`;
}
