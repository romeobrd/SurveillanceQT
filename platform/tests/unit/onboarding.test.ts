// « Premiers pas » : étapes calculées à partir des données.
import { describe, expect, it } from "vitest";
import { onboardingSteps } from "@/features/onboarding/steps";

const empty = {
  zones: 0,
  people: 1,
  assignedWorkstations: 0,
  users: 1,
  stockItems: 0,
  assets: 0,
  subscribed: false,
};

describe("onboardingSteps", () => {
  it("une entreprise qui vient de s'inscrire n'a rien fait (l'administrateur ne compte pas)", () => {
    expect(onboardingSteps(empty).filter((step) => step.done)).toEqual([]);
  });

  it("chaque étape se coche d'après les données", () => {
    const steps = onboardingSteps({
      ...empty,
      zones: 3,
      people: 2,
      assets: 1,
      subscribed: true,
    });
    expect(
      Object.fromEntries(steps.map((step) => [step.key, step.done])),
    ).toEqual({
      layout: true,
      people: true,
      workstations: false,
      accounts: false,
      inventory: true,
      subscription: true,
    });
    expect(steps.find((step) => step.key === "people")?.href).toBe(
      "/import/collaborateurs",
    );
  });
});
