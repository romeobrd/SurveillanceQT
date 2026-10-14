// Abonnement de l'entreprise, vu par son administrateur.
import {
  accessLevel,
  getPlan,
  hasPaidAccess,
  periodEnd,
  type PlanKey,
  trialDaysLeft,
  type Interval,
  type SubscriptionStatus,
} from "@/features/billing/plans";
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import { recordAudit } from "../audit";
import { NotFoundError } from "../errors";
import type { TenantDb } from "../tenant";

export interface BillingView {
  plan: ReturnType<typeof getPlan>;
  status: SubscriptionStatus;
  interval: Interval | null;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  currentPeriodEnd: Date | null;
  access: "full" | "readonly";
  /** Abonnement payé en cours : téléchargement et activation de l'application de bureau. */
  paid: boolean;
  hasCustomer: boolean;
  activePeople: number;
}

export function billingRepository(db: TenantDb, context: AccessContext) {
  async function load() {
    const organization = await db.organization.findUnique({
      where: { id: context.organizationId },
      select: {
        name: true,
        plan: true,
        subscriptionStatus: true,
        billingInterval: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    });
    if (!organization) throw new NotFoundError("Entreprise");
    return organization;
  }

  return {
    async get(now: Date = new Date()): Promise<BillingView> {
      assertPermission(context, "billing:manage");
      const [organization, activePeople] = await Promise.all([
        load(),
        db.person.count({ where: { status: "ACTIVE" } }),
      ]);
      return {
        plan: getPlan(organization.plan),
        status: organization.subscriptionStatus,
        interval: organization.billingInterval,
        trialEndsAt: organization.trialEndsAt,
        trialDaysLeft: trialDaysLeft(organization, now),
        currentPeriodEnd: organization.currentPeriodEnd,
        access: accessLevel(organization, now),
        paid: hasPaidAccess(organization, now),
        hasCustomer: organization.stripeCustomerId !== null,
        activePeople,
      };
    },

    /** Client Stripe de l'entreprise : créé au premier paiement (seul le nom de l'entreprise est transmis). */
    async ensureCustomer(
      create: (input: {
        organizationId: string;
        name: string;
      }) => Promise<string>,
    ): Promise<string> {
      assertPermission(context, "billing:manage");
      const organization = await load();
      if (organization.stripeCustomerId) return organization.stripeCustomerId;
      const customerId = await create({
        organizationId: context.organizationId,
        name: organization.name,
      });
      await db.organization.update({
        where: { id: context.organizationId },
        data: { stripeCustomerId: customerId },
      });
      await recordAudit(db, context, {
        action: "billing.customer",
        resourceType: "Organization",
        resourceId: context.organizationId,
      });
      return customerId;
    },

    /**
     * Démonstration sans Stripe : l'abonnement choisi devient actif comme après un paiement.
     * N'est proposé que lorsque le paiement simulé est autorisé (voir lib/billing/demo.ts).
     */
    async simulateSubscription(
      plan: PlanKey,
      interval: Interval,
      now: Date = new Date(),
    ): Promise<void> {
      assertPermission(context, "billing:manage");
      await db.organization.update({
        where: { id: context.organizationId },
        data: {
          plan,
          billingInterval: interval,
          subscriptionStatus: "ACTIVE",
          trialEndsAt: null,
          currentPeriodEnd: periodEnd(now, interval),
        },
      });
      await recordAudit(db, context, {
        action: "billing.simulated",
        resourceType: "Organization",
        resourceId: context.organizationId,
      });
    },

    /** Téléchargement de l'application de bureau : réservé à un abonnement payé, journalisé. */
    async recordDesktopDownload(now: Date = new Date()): Promise<boolean> {
      assertPermission(context, "billing:manage");
      if (!hasPaidAccess(await load(), now)) return false;
      await recordAudit(db, context, {
        action: "desktop.download",
        resourceType: "Organization",
        resourceId: context.organizationId,
      });
      return true;
    },

    async customerId(): Promise<string | null> {
      assertPermission(context, "billing:manage");
      return (await load()).stripeCustomerId;
    },
  };
}
