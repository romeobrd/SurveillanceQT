"use client";

import { useActionState } from "react";
import {
  resendVerificationAction,
  type ResendState,
} from "@/app/(app)/email-actions";
import { fr } from "@/lib/i18n/fr";

/** Bandeau « confirmez votre adresse », avec renvoi du lien. */
export default function VerifyEmailBanner() {
  const [state, action, pending] = useActionState<ResendState>(
    resendVerificationAction,
    { message: null },
  );
  return (
    <form
      action={action}
      data-testid="verify-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-50 px-4 py-1.5 text-sm text-amber-900"
    >
      <span>{state.message ?? fr.email.verifyBanner}</span>
      <button
        type="submit"
        disabled={pending}
        className="font-medium underline disabled:opacity-60"
      >
        {fr.email.resend}
      </button>
    </form>
  );
}
