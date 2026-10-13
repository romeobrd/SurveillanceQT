// SaaS : inscription en libre-service, essai, lecture seule, limites d'offre, synchronisation Stripe.
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateError, getRepositories, PlanLimitError } from "@/lib/db";
import { findAccessContext } from "@/lib/db/auth-store";
import { applySubscriptionChange } from "@/lib/db/billing-core";
import { createOrganizationWithAdmin } from "@/lib/db/signup";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { verifyPassword } from "@/lib/auth/password";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const signup = {
  company: "Agence Horizon",
  firstName: "Lina",
  lastName: "Martin",
  email: "lina@horizon.test",
  password: "une-phrase-de-passe",
  acceptTerms: "on" as const,
  website: "",
};

describe("inscription en libre-service", () => {
  it("crée l'entreprise en essai, son admin (avec preuve d'acceptation des CGU) et sa fiche", async () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const { organizationId, userId } = await createOrganizationWithAdmin(
      signup,
      now,
    );
    const organization = await testRawPrisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(organization).toMatchObject({
      name: "Agence Horizon",
      plan: "pro",
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date("2026-11-03T10:00:00Z"),
      stripeCustomerId: null,
    });
    const user = await testRawPrisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { person: true },
    });
    expect(user).toMatchObject({
      role: "ADMIN",
      organizationId,
      termsAcceptedAt: now,
      termsVersion: "2026-10",
      mustChangePassword: false,
    });
    expect(user.person).toMatchObject({
      firstName: "Lina",
      lastName: "Martin",
      organizationId,
    });
    expect(await verifyPassword(user.passwordHash, signup.password)).toBe(true);
    expect(
      await testRawPrisma.auditLog.count({
        where: { organizationId, action: "org.signup" },
      }),
    ).toBe(1);
    // L'espace est neuf : aucune donnée d'une autre entreprise n'y est visible
    expect(
      await getRepositories({
        userId,
        organizationId,
        role: "ADMIN",
        personId: user.personId,
      }).people.list({}),
    ).toHaveLength(1);
  });

  it("refuse un e-mail déjà utilisé, sans rien créer", async () => {
    const before = await testRawPrisma.organization.count();
    await expect(
      createOrganizationWithAdmin({ ...signup, email: a.accounts.admin.email }),
    ).rejects.toThrow(DuplicateError);
    expect(await testRawPrisma.organization.count()).toBe(before);
  });
});

describe("essai et lecture seule", () => {
  it("essai en cours : accès complet ; essai terminé : lecture seule, effet immédiat", async () => {
    const { userId, organizationId } =
      await createOrganizationWithAdmin(signup);
    expect(await findAccessContext(userId)).toMatchObject({
      access: "full",
      plan: "pro",
      trialDaysLeft: 14,
    });
    await testRawPrisma.organization.update({
      where: { id: organizationId },
      data: { trialEndsAt: new Date(Date.now() - 1000) },
    });
    expect(await findAccessContext(userId)).toMatchObject({
      access: "readonly",
      trialDaysLeft: 0,
    });
  });

  it("les entreprises existantes (démonstration) gardent l'accès complet", async () => {
    expect(await findAccessContext(a.accounts.admin.userId)).toMatchObject({
      access: "full",
      plan: "business",
    });
  });
});

describe("limites d'offre", () => {
  it("bloque l'ajout d'un collaborateur au-delà de la limite de l'offre", async () => {
    await testRawPrisma.organization.update({
      where: { id: a.organizationId },
      data: { plan: "essentiel" },
    });
    const active = await testRawPrisma.person.count({
      where: { organizationId: a.organizationId, status: "ACTIVE" },
    });
    const people = getRepositories(a.accounts.admin.context).people;
    const input = (n: number) => ({
      firstName: `P${n}`,
      lastName: "Test",
      workEmail: `p${n}@exemple.test`,
      jobTitle: "Testeur",
      teamId: "",
    });
    for (let n = active; n < 15; n++) await people.create(input(n) as never);
    await expect(people.create(input(99) as never)).rejects.toThrow(
      PlanLimitError,
    );
  });
});

describe("synchronisation Stripe", () => {
  const change = (patch: Record<string, unknown> = {}) => ({
    organizationId: a.organizationId,
    customerId: "cus_A",
    subscriptionId: "sub_A",
    status: "ACTIVE" as const,
    plan: "essentiel" as const,
    interval: "YEAR" as const,
    currentPeriodEnd: new Date("2027-10-20T00:00:00Z"),
    ...patch,
  });

  it("active l'abonnement de l'entreprise désignée et le journalise", async () => {
    expect(await applySubscriptionChange(change())).toBe(a.organizationId);
    expect(
      await testRawPrisma.organization.findUniqueOrThrow({
        where: { id: a.organizationId },
      }),
    ).toMatchObject({
      stripeCustomerId: "cus_A",
      stripeSubscriptionId: "sub_A",
      subscriptionStatus: "ACTIVE",
      plan: "essentiel",
      billingInterval: "YEAR",
    });
    expect(
      await testRawPrisma.auditLog.count({
        where: { organizationId: a.organizationId, action: "billing.update" },
      }),
    ).toBe(1);
  });

  it("retrouve ensuite l'entreprise par son client Stripe ; une résiliation est appliquée", async () => {
    await applySubscriptionChange(change());
    await applySubscriptionChange(
      change({ organizationId: null, status: "CANCELED", plan: null }),
    );
    expect(
      await testRawPrisma.organization.findUniqueOrThrow({
        where: { id: a.organizationId },
      }),
    ).toMatchObject({
      subscriptionStatus: "CANCELED",
      plan: "essentiel",
    });
  });

  it("des métadonnées falsifiées ne détournent pas l'abonnement d'une autre entreprise", async () => {
    await applySubscriptionChange(change());
    // Un client Stripe inconnu qui prétend appartenir à A, déjà rattachée à cus_A : ignoré
    expect(
      await applySubscriptionChange(
        change({ customerId: "cus_pirate", subscriptionId: "sub_X" }),
      ),
    ).toBeNull();
    // Un client de A ne peut pas modifier B
    await applySubscriptionChange(
      change({ organizationId: b.organizationId, status: "CANCELED" }),
    );
    expect(
      (
        await testRawPrisma.organization.findUniqueOrThrow({
          where: { id: b.organizationId },
        })
      ).subscriptionStatus,
    ).toBe("ACTIVE");
  });

  it("crée le client Stripe une seule fois, avec le seul nom de l'entreprise", async () => {
    const create = vi.fn(async () => "cus_new");
    const billing = getRepositories(a.accounts.admin.context).billing;
    expect(await billing.ensureCustomer(create)).toBe("cus_new");
    expect(await billing.ensureCustomer(create)).toBe("cus_new");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      organizationId: a.organizationId,
      name: a.name,
    });
  });

  it("vérifie la signature des webhooks (hors ligne)", () => {
    const stripe = new Stripe("sk_test_hors_ligne");
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: { object: {} },
    });
    const secret = "whsec_test";
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    expect(
      stripe.webhooks.constructEvent(payload, header, secret),
    ).toMatchObject({ type: "customer.subscription.updated" });
    expect(() =>
      stripe.webhooks.constructEvent(payload, header, "whsec_autre"),
    ).toThrow();
  });
});
