import { describe, expect, it } from "vitest";
import {
  hasPaidAccess,
  periodEnd,
  accessLevel,
  canAddPerson,
  fromStripeStatus,
  getPlan,
  PLANS,
  trialDaysLeft,
  trialEnd,
  type SubscriptionState,
} from "@/features/billing/plans";

const now = new Date("2026-10-20T12:00:00Z");
const day = 86_400_000;
const state = (patch: Partial<SubscriptionState>): SubscriptionState => ({
  plan: "pro",
  subscriptionStatus: "ACTIVE",
  trialEndsAt: null,
  currentPeriodEnd: null,
  ...patch,
});

describe("offres", () => {
  it("prix et limites croissants, l'annuel offre deux mois", () => {
    const plans = Object.values(PLANS);
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].maxPeople).toBeGreaterThan(plans[i - 1].maxPeople);
      expect(plans[i].monthlyPrice).toBeGreaterThan(plans[i - 1].monthlyPrice);
    }
    for (const plan of plans)
      expect(plan.yearlyPrice).toBe(plan.monthlyPrice * 10);
  });

  it("une offre inconnue retombe sur la plus petite (jamais d'accès élargi)", () => {
    expect(getPlan("platine").key).toBe("essentiel");
  });

  it("limite le nombre de collaborateurs actifs", () => {
    expect(canAddPerson("essentiel", 14)).toBe(true);
    expect(canAddPerson("essentiel", 15)).toBe(false);
    expect(canAddPerson("business", 149)).toBe(true);
  });
});

describe("niveau d'accès", () => {
  it("essai en cours : tout ; essai terminé : lecture seule", () => {
    expect(
      accessLevel(
        state({ subscriptionStatus: "TRIALING", trialEndsAt: trialEnd(now) }),
        now,
      ),
    ).toBe("full");
    expect(
      accessLevel(
        state({
          subscriptionStatus: "TRIALING",
          trialEndsAt: new Date(now.getTime() - 1),
        }),
        now,
      ),
    ).toBe("readonly");
    expect(
      accessLevel(
        state({ subscriptionStatus: "TRIALING", trialEndsAt: null }),
        now,
      ),
    ).toBe("readonly");
  });

  it("abonné ou paiement en relance : tout", () => {
    expect(accessLevel(state({ subscriptionStatus: "ACTIVE" }), now)).toBe(
      "full",
    );
    expect(accessLevel(state({ subscriptionStatus: "PAST_DUE" }), now)).toBe(
      "full",
    );
  });

  it("résilié : accès jusqu'à la fin de la période payée, puis lecture seule", () => {
    expect(
      accessLevel(
        state({
          subscriptionStatus: "CANCELED",
          currentPeriodEnd: new Date(now.getTime() + day),
        }),
        now,
      ),
    ).toBe("full");
    expect(
      accessLevel(
        state({
          subscriptionStatus: "CANCELED",
          currentPeriodEnd: new Date(now.getTime() - day),
        }),
        now,
      ),
    ).toBe("readonly");
  });

  it("compte les jours d'essai restants", () => {
    expect(
      trialDaysLeft(
        state({ subscriptionStatus: "TRIALING", trialEndsAt: trialEnd(now) }),
        now,
      ),
    ).toBe(14);
    expect(
      trialDaysLeft(
        state({
          subscriptionStatus: "TRIALING",
          trialEndsAt: new Date(now.getTime() + 1.2 * day),
        }),
        now,
      ),
    ).toBe(2);
    expect(trialDaysLeft(state({ subscriptionStatus: "ACTIVE" }), now)).toBe(0);
  });

  it("traduit les statuts Stripe", () => {
    expect(fromStripeStatus("trialing")).toBe("TRIALING");
    expect(fromStripeStatus("active")).toBe("ACTIVE");
    expect(fromStripeStatus("past_due")).toBe("PAST_DUE");
    expect(fromStripeStatus("unpaid")).toBe("PAST_DUE");
    expect(fromStripeStatus("canceled")).toBe("CANCELED");
    expect(fromStripeStatus("incomplete_expired")).toBe("CANCELED");
  });
});

describe("application de bureau : abonnement payé", () => {
  const now = new Date("2026-10-14T10:00:00Z");
  const base = { plan: "pro", trialEndsAt: null, currentPeriodEnd: null };

  it("exige un abonnement payé en cours (l'essai ne suffit pas)", () => {
    expect(hasPaidAccess({ ...base, subscriptionStatus: "ACTIVE" }, now)).toBe(
      true,
    );
    expect(
      hasPaidAccess({ ...base, subscriptionStatus: "PAST_DUE" }, now),
    ).toBe(true);
    expect(
      hasPaidAccess(
        {
          ...base,
          subscriptionStatus: "TRIALING",
          trialEndsAt: new Date("2026-10-20"),
        },
        now,
      ),
    ).toBe(false);
    expect(
      hasPaidAccess(
        {
          ...base,
          subscriptionStatus: "CANCELED",
          currentPeriodEnd: new Date("2026-11-01"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      hasPaidAccess(
        {
          ...base,
          subscriptionStatus: "CANCELED",
          currentPeriodEnd: new Date("2026-10-01"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("calcule la fin de période mensuelle ou annuelle", () => {
    expect(periodEnd(now, "MONTH").toISOString()).toBe(
      "2026-11-14T10:00:00.000Z",
    );
    expect(periodEnd(now, "YEAR").toISOString()).toBe(
      "2027-10-14T10:00:00.000Z",
    );
  });
});
