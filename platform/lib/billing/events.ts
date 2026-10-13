// Traduction des événements Stripe en changements d'abonnement : fonctions pures (aucun appel réseau), testées.
import {
  fromStripeStatus,
  isPlanKey,
  type Interval,
  type PlanKey,
  type SubscriptionStatus,
} from "@/features/billing/plans";

/** Correspondance identifiant de prix Stripe → offre et périodicité (lue dans l'environnement). */
export type PriceMap = ReadonlyMap<
  string,
  { plan: PlanKey; interval: Interval }
>;

export interface SubscriptionChange {
  organizationId: string | null;
  customerId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  plan: PlanKey | null;
  interval: Interval | null;
  currentPeriodEnd: Date | null;
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null;
const str = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : isObj(value) && typeof value.id === "string"
      ? value.id
      : null;

/** Variables STRIPE_PRICE_<OFFRE>_<MONTH|YEAR> → table des prix. */
export function priceMapFromEnv(
  env: Record<string, string | undefined>,
): PriceMap {
  const map = new Map<string, { plan: PlanKey; interval: Interval }>();
  for (const [name, value] of Object.entries(env)) {
    const match = /^STRIPE_PRICE_([A-Z]+)_(MONTH|YEAR)$/.exec(name);
    const plan = match?.[1].toLowerCase();
    if (match && value && isPlanKey(plan))
      map.set(value, { plan, interval: match[2] as Interval });
  }
  return map;
}

export function priceIdFor(
  prices: PriceMap,
  plan: PlanKey,
  interval: Interval,
): string | null {
  for (const [id, entry] of prices)
    if (entry.plan === plan && entry.interval === interval) return id;
  return null;
}

/**
 * Événement Stripe (déjà authentifié par sa signature) → changement d'abonnement, ou null s'il ne nous concerne pas.
 * Les événements de création, mise à jour et suppression d'abonnement portent tout ce qu'il faut.
 */
export function toSubscriptionChange(
  event: unknown,
  prices: PriceMap,
): SubscriptionChange | null {
  if (!isObj(event) || typeof event.type !== "string") return null;
  if (
    ![
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return null;
  const data = isObj(event.data) ? event.data : null;
  const subscription = data && isObj(data.object) ? data.object : null;
  if (!subscription) return null;
  const subscriptionId = str(subscription.id);
  const customerId = str(subscription.customer);
  if (!subscriptionId || !customerId) return null;

  const items =
    isObj(subscription.items) && Array.isArray(subscription.items.data)
      ? subscription.items.data.filter(isObj)
      : [];
  const firstItem = items[0];
  const priceId =
    firstItem && isObj(firstItem.price) ? str(firstItem.price.id) : null;
  const entry = priceId ? prices.get(priceId) : undefined;
  // Fin de période : sur l'abonnement (anciennes versions de l'API) ou sur la ligne d'abonnement (récentes)
  const periodEnd =
    typeof subscription.current_period_end === "number"
      ? subscription.current_period_end
      : firstItem && typeof firstItem.current_period_end === "number"
        ? firstItem.current_period_end
        : null;
  const metadata = isObj(subscription.metadata) ? subscription.metadata : {};
  return {
    organizationId: str(metadata.organizationId),
    customerId,
    subscriptionId,
    status:
      event.type === "customer.subscription.deleted"
        ? "CANCELED"
        : fromStripeStatus(String(subscription.status ?? "")),
    plan: entry?.plan ?? null,
    interval: entry?.interval ?? null,
    currentPeriodEnd: periodEnd !== null ? new Date(periodEnd * 1000) : null,
  };
}
