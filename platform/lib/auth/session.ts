// Accès à l'identité de l'utilisateur connecté, côté serveur uniquement.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { findAccessContext } from "@/lib/db/auth-store";
import { auth } from "./config";
import {
  assertPermission,
  type AccessContext,
  type Permission,
} from "./permissions";

export type SessionInfo = AccessContext & { organizationName: string };

/** Lecture de la session sans `connection()` : pour les route handlers (toujours dynamiques). */
export async function readSession(): Promise<SessionInfo | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return findAccessContext(userId);
}

/** Identité courante (relue en base, une fois par requête) ou null si non connecté. */
export const getSessionInfo = cache(async (): Promise<SessionInfo | null> => {
  // Toujours évalué à la requête (jamais prérendu) : la session dépend du cookie de l'utilisateur
  await connection();
  return readSession();
});

/** Exige une session valide : sinon redirection vers la page de connexion. */
export async function requireSession(): Promise<SessionInfo> {
  const info = await getSessionInfo();
  if (!info) redirect("/login");
  return info;
}

/** Exige une session valide ET un droit précis (lève ForbiddenError sinon). */
export async function requirePermission(
  permission: Permission,
): Promise<SessionInfo> {
  const info = await requireSession();
  assertPermission(info, permission);
  return info;
}
