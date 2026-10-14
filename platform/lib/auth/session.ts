// Accès à l'identité de l'utilisateur connecté, côté serveur uniquement.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { findAccessContext } from "@/lib/db/auth-store";
import { desktopGate } from "@/lib/desktop/gate";
import { edition } from "@/lib/edition";
import { auth } from "./config";
import {
  assertPermission,
  type AccessContext,
  type Permission,
} from "./permissions";

export type SessionInfo = AccessContext & {
  organizationName: string;
  /** Mot de passe provisoire : tant qu'il n'est pas changé, seule la page « Mon compte » est accessible. */
  mustChangePassword: boolean;
  /** Lecture seule quand l'essai ou l'abonnement est terminé (voir features/billing/plans.ts). */
  access: "full" | "readonly";
  plan: string;
  trialDaysLeft: number;
  emailVerified: boolean;
};

export const ACCOUNT_PAGE = "/mon-compte";

/** Lecture de la session sans `connection()` : pour les route handlers (toujours dynamiques). */
export async function readSession(): Promise<SessionInfo | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  // Application de bureau : sans licence valide, aucune session (pages, actions et exports compris)
  if (edition() === "desktop" && (await desktopGate()) !== null) return null;
  return findAccessContext(userId);
}

/** Identité courante (relue en base, une fois par requête) ou null si non connecté. */
export const getSessionInfo = cache(async (): Promise<SessionInfo | null> => {
  // Toujours évalué à la requête (jamais prérendu) : la session dépend du cookie de l'utilisateur
  await connection();
  return readSession();
});

/**
 * Session valide, même avec un mot de passe provisoire : réservé à la mise en page commune et à « Mon compte ».
 * Sinon redirection vers la page de connexion.
 */
export async function requireSessionAllowingPasswordChange(): Promise<SessionInfo> {
  const info = await getSessionInfo();
  if (!info) redirect("/login");
  return info;
}

/** Exige une session valide et un mot de passe définitif (sinon : connexion, ou changement de mot de passe). */
export async function requireSession(): Promise<SessionInfo> {
  const info = await requireSessionAllowingPasswordChange();
  if (info.mustChangePassword) redirect(ACCOUNT_PAGE);
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
