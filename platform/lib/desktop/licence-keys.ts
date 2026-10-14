// Clés des licences de l'application de bureau.
// Site : clé privée DESKTOP_LICENCE_PRIVATE_KEY (jamais ailleurs que dans son .env), pour signer.
// Application de bureau : clé publique intégrée au logiciel (licence-public-key.ts), pour vérifier.
import "server-only";
import type { KeyObject } from "node:crypto";
import { createPublicKey } from "node:crypto";
import { privateKeyFrom, publicKeyFrom } from "./licence-grant";
import { LICENCE_PUBLIC_KEY } from "./licence-public-key";

/** Clé de signature du site, null si elle n'est pas configurée (activation indisponible). */
export function siteSigningKey(): KeyObject | null {
  const value = process.env.DESKTOP_LICENCE_PRIVATE_KEY;
  if (!value) return null;
  return privateKeyFrom(value);
}

/** Clé de vérification des attestations que le site a lui-même signées. */
export function siteVerifyingKey(): KeyObject | null {
  const key = siteSigningKey();
  return key ? createPublicKey(key) : null;
}

/**
 * Clé de vérification de l'application de bureau : celle intégrée au logiciel.
 * En développement et en test uniquement, SPACORA_LICENCE_PUBLIC_KEY peut la remplacer.
 */
export function desktopVerifyingKey(): KeyObject | null {
  const override =
    process.env.NODE_ENV !== "production"
      ? process.env.SPACORA_LICENCE_PUBLIC_KEY
      : undefined;
  const value = override || LICENCE_PUBLIC_KEY;
  return value ? publicKeyFrom(value) : null;
}
