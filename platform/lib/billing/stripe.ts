// Prestataire de paiement : Stripe, appelé uniquement côté serveur. Aucun script Stripe dans nos pages :
// le client est redirigé vers les pages hébergées par Stripe (paiement, portail de facturation).
import "server-only";
import Stripe from "stripe";
import type { Interval, PlanKey } from "@/features/billing/plans";
import { priceIdFor, priceMapFromEnv, type PriceMap } from "./events";

export interface BillingProvider {
  prices: PriceMap;
  createCustomer(input: {
    organizationId: string;
    name: string;
  }): Promise<string>;
  createCheckout(input: {
    organizationId: string;
    customerId: string;
    plan: PlanKey;
    interval: Interval;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
  createPortal(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<string>;
  /** Vérifie la signature d'un webhook et renvoie l'événement, ou lève une erreur. */
  verifyWebhook(rawBody: string, signature: string): unknown;
}

let cached: BillingProvider | null | undefined;

/** Stripe configuré (clé secrète, secret de webhook, au moins un prix) ; sinon null : paiement désactivé. */
export function getBillingProvider(): BillingProvider | null {
  if (cached !== undefined) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const prices = priceMapFromEnv(process.env);
  if (!secretKey || !webhookSecret || prices.size === 0) {
    cached = null;
    return null;
  }
  const stripe = new Stripe(secretKey);
  cached = {
    prices,
    async createCustomer({ organizationId, name }) {
      // Seul le nom de l'entreprise est transmis ; Stripe recueille lui-même les coordonnées de facturation
      const customer = await stripe.customers.create({
        name,
        metadata: { organizationId },
      });
      return customer.id;
    },
    async createCheckout({
      organizationId,
      customerId,
      plan,
      interval,
      successUrl,
      cancelUrl,
    }) {
      const price = priceIdFor(prices, plan, interval);
      if (!price)
        throw new Error(`Prix Stripe non configuré : ${plan} ${interval}`);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price, quantity: 1 }],
        client_reference_id: organizationId,
        subscription_data: { metadata: { organizationId } },
        allow_promotion_codes: true,
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" },
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: "fr",
      });
      if (!session.url)
        throw new Error("Stripe n'a pas renvoyé d'adresse de paiement");
      return session.url;
    },
    async createPortal({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        locale: "fr",
      });
      return session.url;
    },
    verifyWebhook(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },
  };
  return cached;
}
