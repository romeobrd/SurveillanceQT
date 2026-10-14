"use server";

import { redirect } from "next/navigation";
import { SignupSchema } from "@/features/signup/schemas";
import { signIn } from "@/lib/auth/config";
import {
  createLocalOrganization,
  localOrganizationExists,
} from "@/lib/db/desktop-local";
import { currentLicence } from "@/lib/desktop/licence-store";
import { edition } from "@/lib/edition";

export type SetupState = {
  error: "invalid" | "mismatch" | null;
  values: {
    company: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.slice(0, 200) : "";

/** Premier lancement : l'entreprise et son administrateur sur ce PC, puis ouverture de Spacora. */
export async function setupAction(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  if (edition() !== "desktop") redirect("/login");
  const licence = await currentLicence();
  if (licence.state !== "valid") redirect("/activation");
  if (await localOrganizationExists()) redirect("/login");
  const values = {
    company: text(formData.get("company")),
    firstName: text(formData.get("firstName")),
    lastName: text(formData.get("lastName")),
    email: text(formData.get("email")),
  };
  const password = formData.get("password");
  if (password !== formData.get("confirm"))
    return { error: "mismatch", values };
  // CGU acceptées sur le site, lors de la création du compte client
  const parsed = SignupSchema.safeParse({
    ...values,
    password,
    acceptTerms: "on",
    website: "",
  });
  if (!parsed.success) return { error: "invalid", values };
  await createLocalOrganization(parsed.data, licence.grant.licence.plan);
  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });
  // Premier écran : la carte vide propose de générer ses locaux ou de partir de zéro
  redirect("/carte");
}
