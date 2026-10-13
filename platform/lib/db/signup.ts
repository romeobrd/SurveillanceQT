// Inscription en libre-service : crée l'entreprise, son premier administrateur et sa fiche, en une transaction.
import "server-only";
import { trialEnd, TRIAL_PLAN } from "@/features/billing/plans";
import { TERMS_VERSION, type SignupInput } from "@/features/signup/schemas";
import { hashPassword } from "@/lib/auth/password";
import { rawPrisma } from "./client";
import { rethrowUnique } from "./errors";

export async function createOrganizationWithAdmin(
  input: SignupInput,
  now: Date = new Date(),
): Promise<{ organizationId: string; userId: string }> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await rawPrisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.company,
          sector: "bureau",
          plan: TRIAL_PLAN,
          subscriptionStatus: "TRIALING",
          trialEndsAt: trialEnd(now),
        },
        select: { id: true },
      });
      const person = await tx.person.create({
        data: {
          organizationId: organization.id,
          firstName: input.firstName,
          lastName: input.lastName,
          workEmail: input.email,
          jobTitle: "Administrateur",
        },
        select: { id: true },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: input.email,
          passwordHash,
          role: "ADMIN",
          personId: person.id,
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: user.id,
          action: "org.signup",
          resourceType: "Organization",
          resourceId: organization.id,
        },
      });
      return { organizationId: organization.id, userId: user.id };
    });
  } catch (error) {
    rethrowUnique(error, "email");
  }
}
