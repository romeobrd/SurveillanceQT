"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { NewPasswordSchema } from "@/features/accounts/schemas";
import { resetRequestRefused } from "@/lib/auth/abuse-limits";
import { signIn } from "@/lib/auth/config";
import { requestIp } from "@/lib/auth/lockout";
import {
  requestPasswordReset,
  setPasswordWithToken,
  verifyEmail,
} from "@/lib/db/email-flows";
import { homeAfterLogin } from "@/lib/edition";

export type LinkState = { status: "idle" | "done" | "invalid" | "badPassword" };

const EmailSchema = z.string().trim().toLowerCase().max(200).pipe(z.email());

/** Mot de passe oublié : toujours la même réponse, que le compte existe ou non. */
export async function forgotPasswordAction(
  _previous: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const email = EmailSchema.safeParse(formData.get("email"));
  // Trop de demandes depuis cette adresse : même réponse, aucun e-mail envoyé
  if (email.success && !resetRequestRefused(await requestIp()))
    await requestPasswordReset(email.data);
  return { status: "done" };
}

const PasswordFormSchema = z
  .object({ password: NewPasswordSchema, confirm: z.string().max(200) })
  .refine((value) => value.password === value.confirm);

async function setPassword(
  purpose: "RESET_PASSWORD" | "INVITE",
  formData: FormData,
): Promise<LinkState> {
  const parsed = PasswordFormSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { status: "badPassword" };
  const email = await setPasswordWithToken(
    String(formData.get("jeton") ?? ""),
    purpose,
    parsed.data.password,
  );
  if (!email) return { status: "invalid" };
  // Connexion directe avec le mot de passe qui vient d'être choisi
  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirect: false,
  });
  redirect(homeAfterLogin());
}

export async function resetPasswordAction(
  _previous: LinkState,
  formData: FormData,
): Promise<LinkState> {
  return setPassword("RESET_PASSWORD", formData);
}

export async function acceptInvitationAction(
  _previous: LinkState,
  formData: FormData,
): Promise<LinkState> {
  return setPassword("INVITE", formData);
}

/** Confirmation d'adresse par un bouton (un simple GET serait consommé par les antivirus qui ouvrent les liens). */
export async function verifyEmailAction(
  _previous: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const ok = await verifyEmail(String(formData.get("jeton") ?? ""));
  return { status: ok ? "done" : "invalid" };
}
