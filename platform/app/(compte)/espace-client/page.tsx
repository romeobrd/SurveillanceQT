import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { simulatePaymentAction } from "./actions";
import {
  checkoutAction,
  portalAction,
} from "@/app/(app)/administration/abonnement/actions";
import ActionForm from "@/components/ui/ActionForm";
import { Badge, Card } from "@/components/ui/layout";
import { PLANS } from "@/features/billing/plans";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { simulatedPaymentAllowed } from "@/lib/billing/demo";
import { getBillingProvider } from "@/lib/billing/stripe";
import { edition } from "@/lib/edition";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.clientArea.title} — ${fr.app.name}`,
};

const t = fr.clientArea;
const b = fr.billing;
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

export default async function ClientAreaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // L'espace client n'existe que sur le site de l'édition « boutique »
  if (edition() !== "boutique") redirect("/tableau-de-bord");
  const { session, repos } = await getAppContext();
  if (!can(session.role, "billing:manage")) redirect("/login");
  const billing = await repos.billing.get();
  const justPaid = (await searchParams).paiement === "ok";
  const stripe = getBillingProvider() !== null;
  const simulated = simulatedPaymentAllowed();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 py-8">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      {justPaid && (
        <p
          role="status"
          className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          {billing.paid ? t.paid : b.paid}
        </p>
      )}

      <Card title={t.subscription}>
        <div
          className="flex flex-col gap-2 text-sm"
          data-testid="client-subscription"
        >
          {billing.paid ? (
            <>
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">
                  {t.active.replace("{plan}", billing.plan.name)}
                </span>
                <Badge tone={billing.status === "PAST_DUE" ? "warn" : "ok"}>
                  {b.status[billing.status]}
                </Badge>
              </p>
              {billing.currentPeriodEnd && (
                <p>
                  {(billing.status === "CANCELED"
                    ? t.canceledUntil
                    : t.until
                  ).replace(
                    "{date}",
                    dateFormat.format(billing.currentPeriodEnd),
                  )}
                </p>
              )}
              {billing.status === "PAST_DUE" && (
                <p className="font-medium text-amber-900">{t.pastDue}</p>
              )}
              {stripe && billing.hasCustomer && (
                <ActionForm
                  action={portalAction}
                  submitLabel={b.manage}
                  variant="secondary"
                  className="mt-2 flex flex-col gap-2"
                >
                  <span className="hidden" />
                </ActionForm>
              )}
            </>
          ) : (
            <p>{t.none}</p>
          )}
        </div>
      </Card>

      <section
        aria-labelledby="download-title"
        className={`rounded-2xl border p-5 ${billing.paid ? "border-brand-500 bg-white shadow-md" : "border-slate-200 bg-white"}`}
      >
        <h2 id="download-title" className="mb-3 text-lg font-semibold">
          {t.downloadTitle}
        </h2>
        {billing.paid ? (
          <>
            <a
              href="/espace-client/telecharger"
              className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 inline-flex rounded-lg px-5 py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t.download}
            </a>
            <ol className="mt-4 list-decimal pl-5 text-sm text-slate-700">
              {t.downloadSteps.map((step) => (
                <li key={step} className="mb-1">
                  {step}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm text-slate-600">{t.downloadLocked}</p>
        )}
      </section>

      <section aria-labelledby="offers-title">
        <h2 id="offers-title" className="mb-3 text-lg font-semibold">
          {billing.paid ? t.change : t.offers}
        </h2>
        {stripe && !session.emailVerified && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t.verifyFirst}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = billing.paid && plan.key === billing.plan.key;
            return (
              <section
                key={plan.key}
                aria-labelledby={`plan-${plan.key}`}
                data-testid={`offer-${plan.key}`}
                className={`flex flex-col gap-3 rounded-2xl border bg-white p-5 ${plan.key === "pro" ? "border-brand-500 shadow-md" : "border-slate-200"}`}
              >
                <h3 id={`plan-${plan.key}`} className="text-lg font-semibold">
                  {plan.name}
                </h3>
                <p>
                  <span className="text-3xl font-semibold">
                    {plan.monthlyPrice}
                  </span>{" "}
                  <span className="text-sm text-slate-600">{b.perMonth}</span>
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {plan.highlights.map((line) => (
                    <li key={line}>✓ {line}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Badge tone="ok">{b.current}</Badge>
                ) : (
                  <div className="mt-auto flex flex-col gap-2">
                    {stripe && (
                      <ActionForm
                        action={checkoutAction}
                        submitLabel={b.choose.replace("{plan}", plan.name)}
                        className="flex flex-col gap-1"
                      >
                        <input type="hidden" name="plan" value={plan.key} />
                        <input type="hidden" name="interval" value="MONTH" />
                      </ActionForm>
                    )}
                    {!stripe && simulated && (
                      <ActionForm
                        action={simulatePaymentAction}
                        submitLabel={`${b.choose.replace("{plan}", plan.name)} — ${t.simulate}`}
                        className="flex flex-col gap-1"
                      >
                        <input type="hidden" name="plan" value={plan.key} />
                        <input type="hidden" name="interval" value="MONTH" />
                      </ActionForm>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-600">
          {stripe ? b.secure : simulated ? t.simulateNote : b.notConfigured}
        </p>
      </section>
    </div>
  );
}
