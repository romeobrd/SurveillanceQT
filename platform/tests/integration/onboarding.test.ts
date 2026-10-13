// « Premiers pas » : réservé à l'administrateur, calculé sur les données de SON entreprise, masquable.
import { beforeEach, describe, expect, it } from "vitest";
import { getRepositories } from "@/lib/db";
import { findAccessContext } from "@/lib/db/auth-store";
import { createOrganizationWithAdmin } from "@/lib/db/signup";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;

beforeEach(async () => {
  ({ a } = await prepareTwoOrganizations());
});

async function newOrganization() {
  const { organizationId, userId } = await createOrganizationWithAdmin({
    company: "Nouvelle PME",
    firstName: "Alex",
    lastName: "Début",
    email: `alex-${Date.now()}@nouvelle.example`,
    password: "un mot de passe solide 42",
    acceptTerms: "on",
    website: "",
  });
  const context = await findAccessContext(userId);
  if (!context) throw new Error("contexte absent");
  return { organizationId, repos: getRepositories(context) };
}

describe("premiers pas", () => {
  it("liste les étapes d'une nouvelle entreprise, puis disparaît une fois masquée", async () => {
    const { organizationId, repos } = await newOrganization();
    const steps = await repos.dashboard.onboarding();
    expect(steps?.every((step) => !step.done)).toBe(true);
    await repos.dashboard.dismissOnboarding();
    expect(await repos.dashboard.onboarding()).toBeNull();
    expect(
      await testRawPrisma.auditLog.count({
        where: { organizationId, action: "org.onboardingDismissed" },
      }),
    ).toBe(1);
  });

  it("n'apparaît pas aux autres rôles ni quand tout est fait", async () => {
    expect(
      await getRepositories(a.accounts.manager.context).dashboard.onboarding(),
    ).toBeNull();
    await expect(
      getRepositories(a.accounts.manager.context).dashboard.dismissOnboarding(),
    ).rejects.toThrow();
    // L'entreprise de test est équipée et abonnée : rien à proposer
    expect(
      await getRepositories(a.accounts.admin.context).dashboard.onboarding(),
    ).toBeNull();
  });
});
