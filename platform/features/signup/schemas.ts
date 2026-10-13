import { z } from "zod";
import { NewPasswordSchema } from "@/features/accounts/schemas";

/** Version des CGU en vigueur : à changer à chaque modification du texte (la preuve d'acceptation la référence). */
export const TERMS_VERSION = "2026-10";

const name = (max: number) => z.string().trim().min(1).max(max);

export const SignupSchema = z.object({
  company: z.string().trim().min(2).max(80),
  firstName: name(60),
  lastName: name(60),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  password: NewPasswordSchema,
  acceptTerms: z.literal("on"),
  /** Champ piège invisible : un humain le laisse vide, un robot le remplit. */
  website: z.string().max(0).optional().default(""),
});
export type SignupInput = z.infer<typeof SignupSchema>;
