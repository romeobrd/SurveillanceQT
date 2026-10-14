"use client";

import { useActionState } from "react";
import { setupAction, type SetupState } from "@/app/demarrage/actions";
import { fr } from "@/lib/i18n/fr";

const t = fr.desktop;
const field =
  "rounded-md border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-brand-600";

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
      <input
        id={id}
        name={id}
        required
        maxLength={200}
        className={field}
        {...props}
      />
    </div>
  );
}

export default function SetupForm({
  initial,
}: {
  initial: SetupState["values"];
}) {
  const [state, action, pending] = useActionState<SetupState, FormData>(
    setupAction,
    {
      error: null,
      values: initial,
    },
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <Field
        id="company"
        label={t.company}
        defaultValue={state.values.company}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="firstName"
          label={t.firstName}
          defaultValue={state.values.firstName}
        />
        <Field
          id="lastName"
          label={t.lastName}
          defaultValue={state.values.lastName}
        />
      </div>
      <Field
        id="email"
        label={t.loginEmail}
        type="email"
        autoComplete="email"
        defaultValue={state.values.email}
      />
      <Field
        id="password"
        label={t.newPassword}
        type="password"
        minLength={12}
        autoComplete="new-password"
      />
      <Field
        id="confirm"
        label={t.confirm}
        type="password"
        minLength={12}
        autoComplete="new-password"
      />
      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {t.setupErrors[state.error]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-md px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? t.creating : t.create}
      </button>
    </form>
  );
}
