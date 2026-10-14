// Paiement simulé, pour les démonstrations sans compte Stripe : jamais quand Stripe est configuré,
// et en production seulement si DEMO_SIMULATED_PAYMENT=1 est explicitement posé.
import "server-only";
import { getBillingProvider } from "./stripe";

export function simulatedPaymentAllowed(): boolean {
  if (getBillingProvider()) return false;
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.DEMO_SIMULATED_PAYMENT === "1"
  );
}
