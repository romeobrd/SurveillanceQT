import { describe, expect, it } from "vitest";
import {
  priceIdFor,
  priceMapFromEnv,
  toSubscriptionChange,
} from "@/lib/billing/events";
import { SignupSchema } from "@/features/signup/schemas";

const prices = priceMapFromEnv({
  STRIPE_PRICE_ESSENTIEL_MONTH: "price_ess_m",
  STRIPE_PRICE_PRO_MONTH: "price_pro_m",
  STRIPE_PRICE_PRO_YEAR: "price_pro_y",
  STRIPE_PRICE_INCONNU_MONTH: "price_x",
  STRIPE_SECRET_KEY: "sk_test",
});

const subscriptionEvent = (
  type: string,
  subscription: Record<string, unknown>,
) => ({
  type,
  data: {
    object: {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { organizationId: "org_1" },
      ...subscription,
    },
  },
});

describe("prix Stripe", () => {
  it("lit les prix dans l'environnement et ignore les offres inconnues", () => {
    expect([...prices.keys()].sort()).toEqual([
      "price_ess_m",
      "price_pro_m",
      "price_pro_y",
    ]);
    expect(priceIdFor(prices, "pro", "YEAR")).toBe("price_pro_y");
    expect(priceIdFor(prices, "business", "MONTH")).toBeNull();
  });
});

describe("événements Stripe → abonnement", () => {
  it("abonnement créé (fin de période sur la ligne, API récente)", () => {
    const change = toSubscriptionChange(
      subscriptionEvent("customer.subscription.created", {
        items: {
          data: [
            { price: { id: "price_pro_y" }, current_period_end: 1_800_000_000 },
          ],
        },
      }),
      prices,
    );
    expect(change).toEqual({
      organizationId: "org_1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      status: "ACTIVE",
      plan: "pro",
      interval: "YEAR",
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
    });
  });

  it("abonnement mis à jour (ancienne API), impayé", () => {
    const change = toSubscriptionChange(
      subscriptionEvent("customer.subscription.updated", {
        status: "past_due",
        current_period_end: 1_700_000_000,
        items: { data: [{ price: { id: "price_ess_m" } }] },
      }),
      prices,
    );
    expect(change).toMatchObject({
      status: "PAST_DUE",
      plan: "essentiel",
      interval: "MONTH",
    });
  });

  it("abonnement supprimé = résilié ; prix inconnu = offre inchangée", () => {
    const change = toSubscriptionChange(
      subscriptionEvent("customer.subscription.deleted", {
        items: { data: [{ price: { id: "price_?" } }] },
      }),
      prices,
    );
    expect(change).toMatchObject({
      status: "CANCELED",
      plan: null,
      interval: null,
    });
  });

  it("ignore les autres événements et les objets mal formés", () => {
    expect(
      toSubscriptionChange(
        { type: "invoice.paid", data: { object: {} } },
        prices,
      ),
    ).toBeNull();
    expect(
      toSubscriptionChange(
        { type: "customer.subscription.updated", data: {} },
        prices,
      ),
    ).toBeNull();
    expect(toSubscriptionChange(null, prices)).toBeNull();
    expect(toSubscriptionChange("texte", prices)).toBeNull();
  });
});

describe("formulaire d'inscription", () => {
  const valid = {
    company: "  Agence Horizon ",
    firstName: "Lina",
    lastName: "Martin",
    email: " Lina@Horizon.TEST ",
    password: "une-phrase-de-passe",
    acceptTerms: "on",
    website: "",
  };

  it("accepte et normalise une inscription complète", () => {
    expect(SignupSchema.parse(valid)).toMatchObject({
      company: "Agence Horizon",
      email: "lina@horizon.test",
    });
  });

  it("refuse sans CGU, mot de passe court, ou champ piège rempli (robot)", () => {
    expect(
      SignupSchema.safeParse({ ...valid, acceptTerms: undefined }).success,
    ).toBe(false);
    expect(
      SignupSchema.safeParse({ ...valid, password: "court" }).success,
    ).toBe(false);
    expect(
      SignupSchema.safeParse({ ...valid, website: "http://spam" }).success,
    ).toBe(false);
    expect(SignupSchema.safeParse({ ...valid, company: "A" }).success).toBe(
      false,
    );
  });
});
