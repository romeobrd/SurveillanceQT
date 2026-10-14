// Offres et règles d'accès de l'abonnement : code pur, testé. Les prix se changent ICI (et dans Stripe).

export const PLAN_KEYS = ["essentiel", "pro", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type Interval = "MONTH" | "YEAR";
export type SubscriptionStatus =
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface Plan {
  key: PlanKey;
  name: string;
  /** Nombre maximal de collaborateurs actifs. */
  maxPeople: number;
  /** Prix HT en euros. L'annuel offre deux mois. */
  monthlyPrice: number;
  yearlyPrice: number;
  highlights: readonly string[];
}

export const PLANS: Readonly<Record<PlanKey, Plan>> = {
  essentiel: {
    key: "essentiel",
    name: "Essentiel",
    maxPeople: 15,
    monthlyPrice: 19,
    yearlyPrice: 190,
    highlights: [
      "Jusqu'à 15 collaborateurs",
      "Carte 3D et mode Aménager",
      "Postes, stock, matériel, projets",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    maxPeople: 50,
    monthlyPrice: 49,
    yearlyPrice: 490,
    highlights: [
      "Jusqu'à 50 collaborateurs",
      "Tout Essentiel",
      "Tendances et réapprovisionnement",
    ],
  },
  business: {
    key: "business",
    name: "Business",
    maxPeople: 150,
    monthlyPrice: 99,
    yearlyPrice: 990,
    highlights: [
      "Jusqu'à 150 collaborateurs",
      "Tout Pro",
      "Support prioritaire",
    ],
  },
};

export const TRIAL_DAYS = 14;
/** L'essai donne accès à l'offre Pro. */
export const TRIAL_PLAN: PlanKey = "pro";

export function isPlanKey(value: unknown): value is PlanKey {
  return (
    typeof value === "string" &&
    (PLAN_KEYS as readonly string[]).includes(value)
  );
}

/** Offre connue, ou la plus petite par défaut (jamais d'accès élargi par erreur). */
export function getPlan(key: string): Plan {
  return isPlanKey(key) ? PLANS[key] : PLANS.essentiel;
}

export interface SubscriptionState {
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

/**
 * Niveau d'accès : « full » ou « readonly ». En lecture seule, on consulte et on exporte ses données
 * (droits RGPD), mais on ne modifie plus rien.
 */
export function accessLevel(
  state: SubscriptionState,
  now: Date,
): "full" | "readonly" {
  switch (state.subscriptionStatus) {
    case "ACTIVE":
    // Paiement en échec : Stripe relance automatiquement ; l'accès reste ouvert, un bandeau prévient
    case "PAST_DUE":
      return "full";
    case "TRIALING":
      return state.trialEndsAt && state.trialEndsAt > now ? "full" : "readonly";
    case "CANCELED":
      // Résilié : accès jusqu'à la fin de la période déjà payée
      return state.currentPeriodEnd && state.currentPeriodEnd > now
        ? "full"
        : "readonly";
  }
}

/** Jours d'essai restants (0 si l'essai est terminé ou absent). */
export function trialDaysLeft(state: SubscriptionState, now: Date): number {
  if (state.subscriptionStatus !== "TRIALING" || !state.trialEndsAt) return 0;
  return Math.max(
    0,
    Math.ceil((state.trialEndsAt.getTime() - now.getTime()) / 86_400_000),
  );
}

export function trialEnd(now: Date): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
}

/** Peut-on ajouter un collaborateur actif de plus avec cette offre ? */
export function canAddPerson(plan: string, activePeople: number): boolean {
  return activePeople < getPlan(plan).maxPeople;
}

/** Statut Stripe → statut de l'application. */
export function fromStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    default:
      // canceled, incomplete_expired, paused…
      return "CANCELED";
  }
}

/**
 * Abonnement payé et en cours : condition pour télécharger et activer l'application de bureau.
 * L'essai gratuit ne suffit pas ; un abonnement résilié reste valable jusqu'à la fin de la période payée.
 */
export function hasPaidAccess(state: SubscriptionState, now: Date): boolean {
  return (
    state.subscriptionStatus !== "TRIALING" &&
    accessLevel(state, now) === "full"
  );
}

/** Fin de la période payée d'un abonnement souscrit maintenant. */
export function periodEnd(now: Date, interval: Interval): Date {
  const end = new Date(now);
  if (interval === "YEAR") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}
