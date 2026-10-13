"use client";

import { useActionState, type ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";

export type ActionState = { error: string | null };

interface ActionFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  /** Style du bouton d'envoi. */
  variant?: "primary" | "danger" | "secondary";
  hideSubmit?: boolean;
}

const buttonStyles = {
  primary: "bg-orange-600 text-white hover:bg-orange-700",
  danger: "bg-red-700 text-white hover:bg-red-800",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
} as const;

export default function ActionForm({
  action,
  children,
  submitLabel = fr.common.save,
  className = "flex flex-col gap-4",
  variant = "primary",
  hideSubmit = false,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {!hideSubmit && (
        <div>
          <button
            type="submit"
            disabled={pending}
            className={`rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-60 ${buttonStyles[variant]}`}
          >
            {pending ? fr.common.saving : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
