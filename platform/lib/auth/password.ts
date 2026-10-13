// Hash des mots de passe : argon2id (SPEC §8.8), paramètres conformes aux recommandations OWASP.
import "server-only";
import { randomInt } from "node:crypto";
import { hash, verify, type Algorithm } from "@node-rs/argon2";

// Valeur de Algorithm.Argon2id : l'enum est ambiant (const enum), inutilisable avec isolatedModules
const ARGON2ID = 2 as Algorithm;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Vérification factice : garde un temps de réponse comparable quand l'e-mail est inconnu. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("mot-de-passe-factice-pour-le-temps-de-reponse");
  await verifyPassword(await dummyHash, password);
}

// Alphabet sans caractères ambigus (0/O, 1/l/I) : le mot de passe provisoire se recopie sans erreur
const TEMPORARY_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Mot de passe provisoire aléatoire (4 groupes de 4, environ 92 bits), à changer à la première connexion. */
export function generateTemporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++)
      group += TEMPORARY_ALPHABET[randomInt(TEMPORARY_ALPHABET.length)];
    groups.push(group);
  }
  return groups.join("-");
}
