// Application des changements d'abonnement reçus de Stripe (webhook, sans session) : seul endroit qui les écrit.
import "server-only";
import type { SubscriptionChange } from "@/lib/billing/events";
import { rawPrisma } from "./client";

/**
 * Met à jour l'abonnement de l'entreprise concernée. Retrouvée par l'identifiant d'entreprise transmis à Stripe
 * (métadonnées) ou, à défaut, par l'identifiant client Stripe. Renvoie l'entreprise mise à jour, ou null.
 */
export async function applySubscriptionChange(
  change: SubscriptionChange,
): Promise<string | null> {
  const byCustomer = await rawPrisma.organization.findUnique({
    where: { stripeCustomerId: change.customerId },
    select: { id: true },
  });
  // Les métadonnées ne font foi que si elles désignent l'entreprise propriétaire de ce client Stripe
  const organizationId =
    byCustomer?.id ??
    (change.organizationId
      ? (
          await rawPrisma.organization.findFirst({
            where: { id: change.organizationId, stripeCustomerId: null },
            select: { id: true },
          })
        )?.id
      : undefined);
  if (!organizationId) return null;
  await rawPrisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeCustomerId: change.customerId,
      stripeSubscriptionId: change.subscriptionId,
      subscriptionStatus: change.status,
      ...(change.plan ? { plan: change.plan } : {}),
      ...(change.interval ? { billingInterval: change.interval } : {}),
      currentPeriodEnd: change.currentPeriodEnd,
    },
  });
  await rawPrisma.auditLog.create({
    data: {
      organizationId,
      actorId: null,
      action: "billing.update",
      resourceType: "Organization",
      resourceId: organizationId,
    },
  });
  return organizationId;
}
