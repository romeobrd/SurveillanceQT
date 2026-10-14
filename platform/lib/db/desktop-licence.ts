// Licences de l'application de bureau, vues par le serveur du site (sans session : appelé par l'application).
// Ne renvoie que le strict nécessaire pour préparer l'application : entreprise, offre, administrateur.
import "server-only";
import { getPlan, hasPaidAccess } from "@/features/billing/plans";
import { rawPrisma } from "./client";

export interface DesktopLicence {
  organizationId: string;
  organizationName: string;
  plan: string;
  planName: string;
  maxPeople: number;
  /** Fin de la période payée (null si inconnue). */
  validUntil: string | null;
  admin: { email: string; firstName: string; lastName: string };
}

export type LicenceLookup =
  | { status: "active"; licence: DesktopLicence }
  | { status: "no_subscription" }
  | { status: "revoked" };

/**
 * Licence d'un compte client : réservée à un administrateur actif dont l'entreprise a un abonnement payé en cours.
 * `organizationId`, quand il est fourni (jeton), doit correspondre à l'entreprise du compte.
 */
export async function lookupDesktopLicence(
  userId: string,
  now: Date,
  organizationId?: string,
): Promise<LicenceLookup> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      disabledAt: true,
      organizationId: true,
      person: { select: { firstName: true, lastName: true } },
      organization: {
        select: {
          name: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
        },
      },
    },
  });
  if (
    !user ||
    user.disabledAt ||
    user.role !== "ADMIN" ||
    (organizationId !== undefined && user.organizationId !== organizationId)
  )
    return { status: "revoked" };
  if (!hasPaidAccess(user.organization, now))
    return { status: "no_subscription" };
  const plan = getPlan(user.organization.plan);
  return {
    status: "active",
    licence: {
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      plan: plan.key,
      planName: plan.name,
      maxPeople: plan.maxPeople,
      validUntil: user.organization.currentPeriodEnd?.toISOString() ?? null,
      admin: {
        email: user.email,
        firstName: user.person?.firstName ?? "",
        lastName: user.person?.lastName ?? "",
      },
    },
  };
}

/** Journal : activation de l'application de bureau par un compte client (identifiants seulement). */
export async function recordDesktopActivation(
  organizationId: string,
  userId: string,
): Promise<void> {
  await rawPrisma.auditLog.create({
    data: {
      organizationId,
      actorId: userId,
      action: "desktop.activation",
      resourceType: "Organization",
      resourceId: organizationId,
    },
  });
}
