// Vérification e-mail + mot de passe, avec limitation des tentatives répétées.
// Partagée par la connexion au site et l'activation de l'application de bureau.
// Trois compteurs : couple adresse IP + compte et adresse IP seule (en mémoire, jamais enregistrés),
// compte seul (en base, empreinte de l'e-mail) contre une attaque venant de nombreuses adresses.
import "server-only";
import {
  clearAttempts,
  findUserForLogin,
  getAttemptState,
  registerFailure,
} from "@/lib/db/auth-store";
import { MemoryLimiter } from "./memory-limiter";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { attemptKey, IP_RULE, isLocked, PAIR_RULE } from "./rate-limit";

export type CredentialsResult =
  { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" };

const byPair = new MemoryLimiter(PAIR_RULE);
const byIp = new MemoryLimiter(IP_RULE);

/** Connexion refusée d'avance (trop d'erreurs depuis cette adresse, ou attaque massive sur ce compte) ? */
export async function isLoginLocked(
  email: string,
  ip: string,
  now: Date = new Date(),
): Promise<boolean> {
  const key = attemptKey(email);
  const time = now.getTime();
  return (
    byIp.isBlocked(ip, time) ||
    byPair.isBlocked(`${ip}|${key}`, time) ||
    isLocked(await getAttemptState(key), now)
  );
}

export async function checkCredentials(
  email: string,
  password: string,
  ip: string,
  now: Date = new Date(),
): Promise<CredentialsResult> {
  if (await isLoginLocked(email, ip, now))
    return { ok: false, reason: "locked" };
  const key = attemptKey(email);
  const found = await findUserForLogin(email);
  // Un compte désactivé est traité comme un compte inconnu : même réponse, même durée
  const user = found && !found.disabledAt ? found : null;
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : false;
  if (!user) await verifyAgainstDummy(password);
  if (!user || !valid) {
    const time = now.getTime();
    byPair.hit(`${ip}|${key}`, time);
    byIp.hit(ip, time);
    await registerFailure(key, now);
    return { ok: false, reason: "invalid" };
  }
  byPair.clear(`${ip}|${key}`);
  await clearAttempts(key);
  return { ok: true, userId: user.id };
}
