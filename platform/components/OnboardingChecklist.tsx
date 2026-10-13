// « Premiers pas » : liste des étapes de mise en route, visible par l'administrateur jusqu'à ce qu'il la masque.
import Link from "next/link";
import { dismissOnboardingAction } from "@/app/(app)/tableau-de-bord/actions";
import ActionForm from "@/components/ui/ActionForm";
import { ProgressBar } from "@/components/ui/layout";
import type { OnboardingStep } from "@/features/onboarding/steps";
import { fr } from "@/lib/i18n/fr";

const t = fr.onboarding;

export default function OnboardingChecklist({
  steps,
}: {
  steps: OnboardingStep[];
}) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section
      aria-labelledby="onboarding-title"
      className="border-brand-200 bg-brand-50 mb-6 rounded-lg border p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="onboarding-title" className="text-lg font-semibold">
            {t.title}
          </h2>
          <p className="text-sm text-slate-700">
            {t.progress
              .replace("{done}", String(done))
              .replace("{total}", String(steps.length))}
          </p>
        </div>
        <ActionForm
          action={dismissOnboardingAction}
          submitLabel={t.dismiss}
          variant="secondary"
          className="flex items-center gap-2"
        >
          {null}
        </ActionForm>
      </div>
      <ProgressBar
        value={Math.round((done / steps.length) * 100)}
        label={t.title}
      />
      <ol className="mt-3 grid gap-2 md:grid-cols-2">
        {steps.map((step) => {
          const text = t.steps[step.key];
          return (
            <li
              key={step.key}
              data-testid={`onboarding-${step.key}`}
              data-done={step.done}
              className="flex items-start gap-3 rounded-md bg-white p-3"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? "bg-green-600 text-white"
                    : "border-2 border-slate-300"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>
              <span className="text-sm">
                {step.done ? (
                  <span className="font-medium text-slate-500 line-through">
                    {text.label}
                  </span>
                ) : (
                  <Link href={step.href} className="font-medium underline">
                    {text.label}
                  </Link>
                )}
                <span className="sr-only">
                  {" "}
                  ({step.done ? t.done : t.todo})
                </span>
                {!step.done && (
                  <span className="block text-slate-600">{text.help}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
