// Accès aux comptes AVANT authentification (connexion) : seul endroit hors couche multi-tenant.
// Ces fonctions ne retournent que le strict nécessaire et ne sont utilisées que par lib/auth.
import "server-only";
import type { AccessContext } from "@/lib/auth/permissions";
import { stateAfterFailure, type AttemptState } from "@/lib/auth/rate-limit";
import { rawPrisma } from "./client";

export async function findUserForLogin(email: string) {
  return rawPrisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, disabledAt: true },
  });
}

/** Identité faisant foi : relue en base à chaque requête (rôle ou compte modifié = effet immédiat). */
export async function findAccessContext(
  userId: string,
): Promise<(AccessContext & { organizationName: string }) | null> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      role: true,
      personId: true,
      disabledAt: true,
      organization: { select: { name: true } },
    },
  });
  // Compte désactivé (départ, anonymisation) : plus aucune session valide, effet immédiat
  if (!user || user.disabledAt) return null;
  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    personId: user.personId,
    organizationName: user.organization.name,
  };
}

export async function getAttemptState(
  key: string,
): Promise<AttemptState | null> {
  const row = await rawPrisma.loginAttempt.findUnique({
    where: { emailKey: key },
  });
  return row ? { failures: row.failures, lockedUntil: row.lockedUntil } : null;
}

export async function registerFailure(
  key: string,
  now: Date = new Date(),
): Promise<AttemptState> {
  return rawPrisma.$transaction(async (tx) => {
    const row = await tx.loginAttempt.findUnique({ where: { emailKey: key } });
    const next = stateAfterFailure(
      row ? { failures: row.failures, lockedUntil: row.lockedUntil } : null,
      now,
    );
    await tx.loginAttempt.upsert({
      where: { emailKey: key },
      create: { emailKey: key, ...next },
      update: next,
    });
    return next;
  });
}

export async function clearAttempts(key: string): Promise<void> {
  await rawPrisma.loginAttempt.deleteMany({ where: { emailKey: key } });
}
