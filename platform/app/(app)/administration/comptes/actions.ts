"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  formObject,
  guarded,
  guardedValue,
  type ActionState,
} from "@/lib/actions";
import { companyEmailRefused } from "@/lib/auth/abuse-limits";
import { InviteNeedsVerifiedEmailError, TooManyRequestsError } from "@/lib/db";
import { appBaseUrl, emailAvailable, sendEmail } from "@/lib/email/send";
import { inviteTemplate, resetPasswordTemplate } from "@/lib/email/templates";
import { fr } from "@/lib/i18n/fr";

const IdSchema = z.string().min(1).max(64);

export type PasswordActionState = ActionState & {
  temporaryPassword?: string;
  email?: string;
  /** Message de confirmation quand un e-mail a été envoyé à la place d'un mot de passe provisoire. */
  notice?: string;
};

export async function createAccountAction(
  _previous: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  // E-mails disponibles : invitation (la personne choisit son mot de passe) ; sinon mot de passe provisoire
  const invite = emailAvailable();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const result = await guardedValue("users:manage", async (repos, session) => {
    // Invitation par e-mail : adresse de l'administrateur confirmée, nombre d'envois limité
    if (invite) {
      if (!session.emailVerified) throw new InviteNeedsVerifiedEmailError();
      if (companyEmailRefused(session.organizationId))
        throw new TooManyRequestsError();
    }
    const created = await repos.accounts.create(formObject(formData), {
      invite,
    });
    if (created.inviteToken)
      await sendEmail(
        email,
        inviteTemplate({
          organization: session.organizationName,
          url: `${appBaseUrl()}/invitation?jeton=${created.inviteToken}`,
        }),
      );
    return created;
  });
  if (result.error || !result.value) return { error: result.error };
  revalidatePath("/administration/comptes");
  return result.value.inviteToken
    ? { error: null, notice: fr.accounts.invited.replace("{email}", email) }
    : { error: null, temporaryPassword: result.value.temporaryPassword, email };
}

export async function resetPasswordAction(
  _previous: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const byEmail = emailAvailable();
  const result = await guardedValue("users:manage", async (repos, session) => {
    if (byEmail && companyEmailRefused(session.organizationId))
      throw new TooManyRequestsError();
    const reset = await repos.accounts.resetPassword(
      IdSchema.parse(formData.get("id")),
      { byEmail },
    );
    if (reset.resetToken)
      await sendEmail(
        reset.email,
        resetPasswordTemplate({
          url: `${appBaseUrl()}/reinitialiser?jeton=${reset.resetToken}`,
        }),
      );
    return reset;
  });
  if (result.error || !result.value) return { error: result.error };
  revalidatePath("/administration/comptes");
  return result.value.resetToken
    ? {
        error: null,
        notice: fr.accounts.resetSent.replace("{email}", result.value.email),
      }
    : {
        error: null,
        temporaryPassword: result.value.temporaryPassword,
        email: result.value.email,
      };
}

export async function setRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("users:manage", (repos) =>
    repos.accounts.setRole(
      IdSchema.parse(formData.get("id")),
      formData.get("role"),
    ),
  );
  if (!result.error) revalidatePath("/administration/comptes");
  return result;
}

export async function setDisabledAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("users:manage", (repos) =>
    repos.accounts.setDisabled(
      IdSchema.parse(formData.get("id")),
      formData.get("disabled") === "true",
    ),
  );
  if (!result.error) revalidatePath("/administration/comptes");
  return result;
}
