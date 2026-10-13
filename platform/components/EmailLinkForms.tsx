"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  acceptInvitationAction,
  forgotPasswordAction,
  resetPasswordAction,
  verifyEmailAction,
  type LinkState,
} from "@/app/email-link-actions";
import { fr } from "@/lib/i18n/fr";

const t = fr.email;
const fieldClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const buttonClass =
  "bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-md px-4 py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const initial: LinkState = { status: "idle" };

function Message({
  tone,
  children,
}: {
  tone: "ok" | "error";
  children: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-testid={tone === "error" ? "link-error" : "link-done"}
      className={`rounded-md px-3 py-2 text-sm ${tone === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-900"}`}
    >
      {children}
    </p>
  );
}

const BackToLogin = () => (
  <Link href="/login" className="text-center text-sm underline">
    {t.backToLogin}
  </Link>
);

export function ForgotPasswordForm({ available }: { available: boolean }) {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initial,
  );
  if (!available)
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Message tone="error">{t.forgotUnavailable}</Message>
        <BackToLogin />
      </div>
    );
  if (state.status === "done")
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Message tone="ok">{t.forgotSent}</Message>
        <BackToLogin />
      </div>
    );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <p className="text-sm text-slate-700">{t.forgotHelp}</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {fr.auth.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className={fieldClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {t.forgotSubmit}
      </button>
      <BackToLogin />
    </form>
  );
}

/** Choix d'un mot de passe depuis un lien reçu par e-mail (réinitialisation ou invitation). */
export function SetPasswordForm({
  token,
  mode,
}: {
  token: string;
  mode: "reset" | "invite";
}) {
  const [state, action, pending] = useActionState(
    mode === "reset" ? resetPasswordAction : acceptInvitationAction,
    initial,
  );
  if (state.status === "invalid")
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Message tone="error">{t.invalidLink}</Message>
        <BackToLogin />
      </div>
    );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      {mode === "invite" && (
        <p className="text-sm text-slate-700">{t.inviteHelp}</p>
      )}
      <input type="hidden" name="jeton" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={200}
          autoComplete="new-password"
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium">
          {t.confirmLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={12}
          maxLength={200}
          autoComplete="new-password"
          className={fieldClass}
        />
      </div>
      {state.status === "badPassword" && (
        <Message tone="error">{t.passwordInvalid}</Message>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {mode === "reset" ? t.resetSubmit : t.inviteSubmit}
      </button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initial);
  if (state.status === "done")
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Message tone="ok">{t.verified}</Message>
        <Link href="/tableau-de-bord" className={`${buttonClass} text-center`}>
          {t.continue}
        </Link>
      </div>
    );
  if (state.status === "invalid")
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Message tone="error">{t.invalidLink}</Message>
        <BackToLogin />
      </div>
    );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="jeton" value={token} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {t.verifyButton}
      </button>
    </form>
  );
}
