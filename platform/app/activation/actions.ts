"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { localOrganizationExists } from "@/lib/db/desktop-local";
import { accountServerUrl, activateLicence } from "@/lib/desktop/licence-store";
import { edition } from "@/lib/edition";

export type ActivationState = {
  error: "invalid" | "locked" | "no_subscription" | "offline" | null;
  email: string;
};

const ActivationSchema = z.object({
  email: z.string().trim().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
  // Adresse du site Spacora (démonstration locale : http://localhost:3000) ; http ou https uniquement
  accountUrl: z
    .string()
    .trim()
    .max(300)
    .pipe(z.url({ protocol: /^https?$/ })),
});

/** Activation de l'application de bureau avec le compte client du site (abonnement payé requis). */
export async function activateAction(
  _previous: ActivationState,
  formData: FormData,
): Promise<ActivationState> {
  if (edition() !== "desktop") redirect("/login");
  const email = String(formData.get("email") ?? "").slice(0, 200);
  const parsed = ActivationSchema.safeParse({
    email,
    password: formData.get("password"),
    accountUrl: formData.get("accountUrl") || accountServerUrl(),
  });
  if (!parsed.success) return { error: "invalid", email };
  const result = await activateLicence(
    parsed.data.email,
    parsed.data.password,
    parsed.data.accountUrl,
  );
  if (result !== "active") return { error: result, email };
  redirect((await localOrganizationExists()) ? "/login" : "/demarrage");
}
