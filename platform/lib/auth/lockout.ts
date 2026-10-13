// Vérification du verrouillage avant tentative de connexion.
import "server-only";
import { getAttemptState } from "@/lib/db/auth-store";
import { attemptKey, isLocked } from "./rate-limit";

export async function isEmailLocked(email: string): Promise<boolean> {
  return isLocked(await getAttemptState(attemptKey(email)), new Date());
}
