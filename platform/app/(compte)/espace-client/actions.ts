"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PLAN_KEYS } from "@/features/billing/plans";
import { guarded, type ActionState } from "@/lib/actions";
import { simulatedPaymentAllowed } from "@/lib/billing/demo";

const SimulateSchema = z.object({
  plan: z.enum(PLAN_KEYS),
  interval: z.enum(["MONTH", "YEAR"]),
});

/** Démonstration sans Stripe : active l'offre choisie comme après un paiement (journalisé). */
export async function simulatePaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!simulatedPaymentAllowed())
    return { error: "Paiement simulé indisponible." };
  const result = await guarded("billing:manage", async (repos) => {
    const { plan, interval } = SimulateSchema.parse({
      plan: formData.get("plan"),
      interval: formData.get("interval"),
    });
    await repos.billing.simulateSubscription(plan, interval);
  });
  if (result.error) return result;
  redirect("/espace-client?paiement=ok");
}
