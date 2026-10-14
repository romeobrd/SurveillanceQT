"use client";

import { useActionState } from "react";
import { activateAction, type ActivationState } from "@/app/activation/actions";
import { fr } from "@/lib/i18n/fr";

const t = fr.desktop;
const field =
  "rounded-md border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-brand-600";

export default function ActivationForm({ accountUrl }: { accountUrl: string }) {
  const [state, action, pending] = useActionState<ActivationState, FormData>(
    activateAction,
    { error: null, email: "" },
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          defaultValue={state.email}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          maxLength={200}
          autoComplete="current-password"
          className={field}
        />
      </div>
      {/* Démonstration sur un seul PC : le site tourne sur cet ordinateur (http://localhost:3000) */}
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-600">
          {t.advanced}
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="accountUrl" className="font-medium">
            {t.accountUrl}
          </label>
          <input
            id="accountUrl"
            name="accountUrl"
            type="url"
            maxLength={300}
            defaultValue={accountUrl}
            className={field}
          />
        </div>
      </details>
      {state.error && (
        <p
          role="alert"
          data-testid="activation-error"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {t.errors[state.error]}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-md px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? t.activating : t.activate}
      </button>
    </form>
  );
}
