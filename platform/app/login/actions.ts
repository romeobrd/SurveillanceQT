"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { CredentialsSchema, signIn, signOut } from "@/lib/auth/config";
import { isEmailLocked } from "@/lib/auth/lockout";

export type LoginState = {
  error: "invalid" | "locked" | "invalidForm" | null;
  /** E-mail saisi, réaffiché après une erreur (le mot de passe, lui, est toujours effacé). */
  email: string;
};

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";
  if (!parsed.success) return { error: "invalidForm", email };

  if (await isEmailLocked(parsed.data.email)) {
    return { error: "locked", email };
  }
  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "invalid", email };
    throw error;
  }
  redirect("/tableau-de-bord");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
