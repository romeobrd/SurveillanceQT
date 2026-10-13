"use client";

import { useActionState, type ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";

export type PasswordActionState = {
  error: string | null;
  temporaryPassword?: string;
  email?: string;
  notice?: string;
};

/**
 * Formulaire dont l'action renvoie un mot de passe provisoire : il est affiché une seule fois,
 * dans la page (jamais stocké en clair, jamais envoyé par e-mail).
 */
export default function TemporaryPasswordForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-4",
  variant = "primary",
}: {
  action: (
    state: PasswordActionState,
    formData: FormData,
  ) => Promise<PasswordActionState>;
  submitLabel: string;
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className={className}>
        {children}
        <div>
          <button
            type="submit"
            disabled={pending}
            className={`focus-visible:outline-brand-600 rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
              variant === "primary"
                ? "bg-brand-600 hover:bg-brand-700 text-white"
                : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
            }`}
          >
            {pending ? fr.common.saving : submitLabel}
          </button>
        </div>
      </form>
      {state.error && (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.notice && (
        <p
          role="status"
          data-testid="account-notice"
          className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900"
        >
          {state.notice}
        </p>
      )}
      {state.temporaryPassword && (
        <div
          role="status"
          data-testid="temporary-password"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p className="font-semibold">
            {fr.accounts.temporaryTitle}
            {state.email ? ` — ${state.email}` : ""}
          </p>
          <p className="my-1 font-mono text-lg tracking-wide select-all">
            {state.temporaryPassword}
          </p>
          <p className="text-xs text-amber-900">{fr.accounts.temporaryHelp}</p>
        </div>
      )}
    </div>
  );
}
