import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminTabs from "../AdminTabs";
import { checkoutAction, portalAction } from "./actions";
import ActionForm from "@/components/ui/ActionForm";
import { Badge, Card } from "@/components/ui/layout";
import { PLANS } from "@/features/billing/plans";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { getBillingProvider } from "@/lib/billing/stripe";
import { edition } from "@/lib/edition";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.billing.title} — ${fr.app.name}`,
};

const t = fr.billing;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Application de bureau : l'abonnement se gère dans l'espace client du site
  if (edition() === "desktop") redirect("/administration");
  const { session, repos } = await getAppContext();
  if (!can(session.role, "billing:manage")) redirect("/tableau-de-bord");
  const billing = await repos.billing.get();
  const paid = (await searchParams).paiement === "ok";
  const configured = getBillingProvider() !== null;
  const subscribed =
    billing.status === "ACTIVE" || billing.status === "PAST_DUE";

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.admin.title}</h1>
      <AdminTabs current="/administration/abonnement" />
      {paid && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          {t.paid}
        </p>
      )}

      <Card title={t.currentPlan}>
        <div
          className="flex flex-col gap-2 text-sm"
          data-testid="billing-status"
        >
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{billing.plan.name}</span>
            <Badge
              tone={
                billing.access === "readonly"
                  ? "alert"
                  : billing.status === "PAST_DUE"
                    ? "warn"
                    : "ok"
              }
            >
              {t.status[billing.status]}
            </Badge>
          </p>
          <p>
            {t.usage
              .replace("{count}", String(billing.activePeople))
              .replace("{max}", String(billing.plan.maxPeople))}
          </p>
          {billing.status === "TRIALING" && (
            <p>
              {billing.trialDaysLeft > 0 && billing.trialEndsAt
                ? t.trialLeft
                    .replace("{days}", String(billing.trialDaysLeft))
                    .replace("{date}", dateFormat.format(billing.trialEndsAt))
                : t.trialOver}
            </p>
          )}
          {billing.status === "ACTIVE" && billing.currentPeriodEnd && (
            <p>
              {t.periodEnd.replace(
                "{date}",
                dateFormat.format(billing.currentPeriodEnd),
              )}
            </p>
          )}
          {billing.status === "CANCELED" &&
            billing.currentPeriodEnd &&
            billing.access === "full" && (
              <p>
                {t.accessUntil.replace(
                  "{date}",
                  dateFormat.format(billing.currentPeriodEnd),
                )}
              </p>
            )}
          {billing.status === "PAST_DUE" && (
            <p className="font-medium text-amber-900">{t.pastDue}</p>
          )}
          {billing.access === "readonly" && (
            <p className="font-medium text-red-800">{t.readonly}</p>
          )}
          {!configured && <p className="text-slate-600">{t.notConfigured}</p>}
          {configured && billing.hasCustomer && (
            <ActionForm
              action={portalAction}
              submitLabel={t.manage}
              variant="secondary"
              className="mt-2 flex flex-col gap-2"
            >
              <span className="hidden" />
            </ActionForm>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = subscribed && plan.key === billing.plan.key;
          return (
            <section
              key={plan.key}
              aria-labelledby={`plan-${plan.key}`}
              className={`flex flex-col gap-3 rounded-2xl border p-5 ${plan.key === "pro" ? "border-brand-500 shadow-md" : "border-slate-200"}`}
            >
              <h2 id={`plan-${plan.key}`} className="text-lg font-semibold">
                {plan.name}
              </h2>
              <p>
                <span className="text-3xl font-semibold">
                  {plan.monthlyPrice}
                </span>{" "}
                <span className="text-sm text-slate-600">{t.perMonth}</span>
                <span className="block text-xs text-slate-600">
                  {t.yearly} : {plan.yearlyPrice} {t.perYear}
                </span>
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {plan.highlights.map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
              {isCurrent ? (
                <Badge tone="ok">{t.current}</Badge>
              ) : (
                configured && (
                  <div className="mt-auto flex flex-col gap-2">
                    {(["MONTH", "YEAR"] as const).map((interval) => (
                      <ActionForm
                        key={interval}
                        action={checkoutAction}
                        submitLabel={`${t.choose.replace("{plan}", plan.name)} — ${interval === "MONTH" ? t.monthly : t.yearly}`}
                        variant={interval === "MONTH" ? "primary" : "secondary"}
                        className="flex flex-col gap-1"
                      >
                        <input type="hidden" name="plan" value={plan.key} />
                        <input type="hidden" name="interval" value={interval} />
                      </ActionForm>
                    ))}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-600">{t.secure}</p>
    </div>
  );
}
