import { z } from "zod";

export const ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;
export const RoleSchema = z.enum(ROLES);

/** Création d'un compte : l'e-mail de connexion, le rôle, et le collaborateur rattaché (facultatif). */
export const AccountInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  role: RoleSchema,
  personId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().min(1).max(64).optional(),
  ),
});
export type AccountInput = z.infer<typeof AccountInputSchema>;

/** Nouveau mot de passe : 12 caractères minimum (recommandation ANSSI / CNIL pour un mot de passe seul). */
export const NewPasswordSchema = z.string().min(12).max(200);

export const PasswordChangeSchema = z
  .object({
    current: z.string().min(1).max(200),
    next: NewPasswordSchema,
    confirm: z.string().max(200),
  })
  .refine((value) => value.next === value.confirm, { path: ["confirm"] })
  .refine((value) => value.next !== value.current, { path: ["next"] });
