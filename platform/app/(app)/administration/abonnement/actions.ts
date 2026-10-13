"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PLAN_KEYS } from "@/features/billing/plans";
import { guardedValue, type ActionState } from "@/lib/actions";
import { getBillingProvider } from "@/lib/billing/stripe";
import { fr } from "@/lib/i18n/fr";

const CheckoutSchema = z.object({
  plan: z.enum(PLAN_KEYS),
  interval: z.enum(["MONTH", "YEAR"]),
});

/** Adresse publique de l'application, pour les retours depuis Stripe. */
async function appOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL;
  if (configured) return new URL(configured).origin;
  const h = await headers();
  return h.get("origin") ?? `http://${h.get("host") ?? "localhost:3000"}`;
}

export async function checkoutAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const provider = getBillingProvider();
  if (!provider) return { error: fr.billing.notConfigured };
  const origin = await appOrigin();
  const result = await guardedValue(
    "billing:manage",
    async (repos, session) => {
      const { plan, interval } = CheckoutSchema.parse({
        plan: formData.get("plan"),
        interval: formData.get("interval"),
      });
      const customerId = await repos.billing.ensureCustomer((input) =>
        provider.createCustomer(input),
      );
      return provider.createCheckout({
        organizationId: session.organizationId,
        customerId,
        plan,
        interval,
        successUrl: `${origin}/administration/abonnement?paiement=ok`,
        cancelUrl: `${origin}/administration/abonnement`,
      });
    },
  );
  if (result.error || !result.value) return { error: result.error };
  redirect(result.value);
}

export async function portalAction(): Promise<ActionState> {
  const provider = getBillingProvider();
  if (!provider) return { error: fr.billing.notConfigured };
  const origin = await appOrigin();
  const result = await guardedValue("billing:manage", async (repos) => {
    const customerId = await repos.billing.customerId();
    if (!customerId) return null;
    return provider.createPortal({
      customerId,
      returnUrl: `${origin}/administration/abonnement`,
    });
  });
  if (result.error) return { error: result.error };
  if (!result.value) return { error: fr.billing.noCustomer };
  redirect(result.value);
}
