// Vérification e-mail + mot de passe, avec verrouillage après échecs répétés (aucune adresse IP conservée).
// Partagée par la connexion au site et l'activation de l'application de bureau.
import "server-only";
import {
  clearAttempts,
  findUserForLogin,
  getAttemptState,
  registerFailure,
} from "@/lib/db/auth-store";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { attemptKey, isLocked } from "./rate-limit";

export type CredentialsResult =
  { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" };

export async function checkCredentials(
  email: string,
  password: string,
  now: Date = new Date(),
): Promise<CredentialsResult> {
  const key = attemptKey(email);
  if (isLocked(await getAttemptState(key), now))
    return { ok: false, reason: "locked" };
  const found = await findUserForLogin(email);
  // Un compte désactivé est traité comme un compte inconnu : même réponse, même durée
  const user = found && !found.disabledAt ? found : null;
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : false;
  if (!user) await verifyAgainstDummy(password);
  if (!user || !valid) {
    await registerFailure(key);
    return { ok: false, reason: "invalid" };
  }
  await clearAttempts(key);
  return { ok: true, userId: user.id };
}
