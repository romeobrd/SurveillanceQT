"use server";

import { redirect } from "next/navigation";
import { SignupSchema } from "@/features/signup/schemas";
import { signIn } from "@/lib/auth/config";
import { isEmailLocked } from "@/lib/auth/lockout";
import { DuplicateError } from "@/lib/db";
import { createOrganizationWithAdmin } from "@/lib/db/signup";

export type SignupState = {
  error: "invalid" | "terms" | "duplicate" | "locked" | null;
  /** Valeurs réaffichées après une erreur (jamais le mot de passe). */
  values: {
    company: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.slice(0, 200) : "";

export async function signupAction(
  _previous: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const values = {
    company: text(formData.get("company")),
    firstName: text(formData.get("firstName")),
    lastName: text(formData.get("lastName")),
    email: text(formData.get("email")),
  };
  const parsed = SignupSchema.safeParse({
    ...values,
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") ?? undefined,
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    const termsMissing = parsed.error.issues.some(
      (issue) => issue.path[0] === "acceptTerms",
    );
    return { error: termsMissing ? "terms" : "invalid", values };
  }
  // Même verrou que la connexion (empreinte de l'e-mail, aucune adresse IP conservée)
  if (await isEmailLocked(parsed.data.email))
    return { error: "locked", values };
  try {
    await createOrganizationWithAdmin(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateError) return { error: "duplicate", values };
    throw error;
  }
  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });
  // Premier écran : la carte vide propose de générer ses locaux ou de partir de zéro
  redirect("/carte");
}
