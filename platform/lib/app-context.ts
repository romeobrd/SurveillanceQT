import "server-only";
import { requireSession, type SessionInfo } from "@/lib/auth/session";
import { getRepositories, type Repositories } from "@/lib/db";

/** Session vérifiée + accès aux données de l'entreprise, pour les pages serveur. */
export async function getAppContext(): Promise<{
  session: SessionInfo;
  repos: Repositories;
}> {
  const session = await requireSession();
  return { session, repos: getRepositories(session) };
}
