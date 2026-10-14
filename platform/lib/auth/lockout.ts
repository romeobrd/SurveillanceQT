// Vérification du verrouillage avant tentative de connexion (adresse IP de la requête en cours).
import "server-only";
import { headers } from "next/headers";
import { clientIp } from "./client-ip";
import { isLoginLocked } from "./credentials";

/** Adresse IP de la requête en cours (server action, page). */
export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

export async function isEmailLocked(email: string): Promise<boolean> {
  return isLoginLocked(email, await requestIp());
}
