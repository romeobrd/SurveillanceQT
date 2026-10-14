"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupState } from "@/app/inscription/actions";
import { fr } from "@/lib/i18n/fr";

const initial: SignupState = {
  error: null,
  values: { company: "", firstName: "", lastName: "", email: "" },
};
const fieldClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const t = fr.signup;

function Field({
  id,
  label,
  ...props
}: {
  id: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} name={id} className={fieldClass} {...props} />
    </div>
  );
}

export default function SignupForm({
  submitLabel = t.submit,
}: {
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState(signupAction, initial);
  return (
    <form
      action={action}
      className="flex w-full max-w-md flex-col gap-4"
      noValidate
    >
      <Field
        id="company"
        label={t.company}
        defaultValue={state.values.company}
        required
        maxLength={80}
        autoComplete="organization"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="firstName"
          label={t.firstName}
          defaultValue={state.values.firstName}
          required
          maxLength={60}
          autoComplete="given-name"
        />
        <Field
          id="lastName"
          label={t.lastName}
          defaultValue={state.values.lastName}
          required
          maxLength={60}
          autoComplete="family-name"
        />
      </div>
      <Field
        id="email"
        label={t.email}
        type="email"
        defaultValue={state.values.email}
        required
        maxLength={200}
        autoComplete="email"
      />
      <Field
        id="password"
        label={t.password}
        type="password"
        required
        minLength={12}
        maxLength={200}
        autoComplete="new-password"
      />
      {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Site web</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" className="mt-1" required />
        <span>
          {t.acceptTerms} (
          <Link href="/cgu" className="underline" target="_blank">
            {t.terms}
          </Link>
          ,{" "}
          <Link href="/confidentialite" className="underline" target="_blank">
            {t.privacy}
          </Link>
          )
        </span>
      </label>
      {state.error && (
        <p
          role="alert"
          data-testid="signup-error"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {t.errors[state.error]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-md px-4 py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? t.submitting : submitLabel}
      </button>
      <p className="text-center text-sm text-slate-600">
        {t.haveAccount}{" "}
        <Link href="/login" className="font-medium text-slate-900 underline">
          {fr.auth.submit}
        </Link>
      </p>
    </form>
  );
}
