"use server";

import { requireSessionAllowingPasswordChange } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/db/email-flows";
import { fr } from "@/lib/i18n/fr";

export type ResendState = { message: string | null };

/** Renvoie le lien de confirmation d'adresse au compte connecté (au plus un toutes les deux minutes). */
export async function resendVerificationAction(): Promise<ResendState> {
  const session = await requireSessionAllowingPasswordChange();
  const result = await sendVerificationEmail(session.userId);
  return {
    message:
      result === "throttled"
        ? fr.email.throttled
        : result === "sent"
          ? fr.email.resent
          : null,
  };
}
