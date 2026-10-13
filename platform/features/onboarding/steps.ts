// « Premiers pas » : étapes de mise en route calculées à partir des données réelles de l'entreprise.

export interface OnboardingCounts {
  zones: number;
  people: number;
  assignedWorkstations: number;
  users: number;
  stockItems: number;
  assets: number;
  subscribed: boolean;
}

export const ONBOARDING_STEPS = [
  "layout",
  "people",
  "workstations",
  "accounts",
  "inventory",
  "subscription",
] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  href: string;
}

const HREFS: Record<OnboardingStepKey, string> = {
  layout: "/carte",
  people: "/import/collaborateurs",
  workstations: "/postes",
  accounts: "/administration/comptes",
  inventory: "/import/stock",
  subscription: "/administration/abonnement",
};

export function onboardingSteps(counts: OnboardingCounts): OnboardingStep[] {
  const done: Record<OnboardingStepKey, boolean> = {
    layout: counts.zones > 0,
    // L'administrateur est lui-même collaborateur dès l'inscription
    people: counts.people > 1,
    workstations: counts.assignedWorkstations > 0,
    accounts: counts.users > 1,
    inventory: counts.stockItems + counts.assets > 0,
    subscription: counts.subscribed,
  };
  return ONBOARDING_STEPS.map((key) => ({
    key,
    done: done[key],
    href: HREFS[key],
  }));
}
