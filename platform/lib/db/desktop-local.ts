// Application de bureau : l'unique entreprise de la base locale (sur le PC du client).
// Créée au premier lancement, après activation ; son offre suit l'abonnement du compte client.
import "server-only";
import type { SignupInput } from "@/features/signup/schemas";
import { getPlan } from "@/features/billing/plans";
import { rawPrisma } from "./client";
import { createOrganizationWithAdmin } from "./signup";

export async function localOrganizationExists(): Promise<boolean> {
  return (await rawPrisma.organization.count()) > 0;
}

/** Première entreprise de l'application : abonnement actif (payé sur le site), adresse e-mail confirmée. */
export async function createLocalOrganization(
  input: SignupInput,
  plan: string,
  now: Date = new Date(),
): Promise<{ organizationId: string; userId: string }> {
  if (await localOrganizationExists())
    throw new Error("L'entreprise de cette application existe déjà");
  const created = await createOrganizationWithAdmin(input, now, {
    emailVerified: true,
  });
  await rawPrisma.organization.update({
    where: { id: created.organizationId },
    data: {
      plan: getPlan(plan).key,
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
      currentPeriodEnd: null,
    },
  });
  return created;
}

/** L'offre locale suit celle du compte client (limite de collaborateurs). */
export async function syncLocalPlan(plan: string): Promise<void> {
  await rawPrisma.organization.updateMany({
    data: { plan: getPlan(plan).key },
  });
}
