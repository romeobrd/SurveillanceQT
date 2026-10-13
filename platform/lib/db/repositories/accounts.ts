// Comptes de connexion : création par l'administrateur, rôles, désactivation, mots de passe.
// Aucun envoi d'e-mail (pas de service tiers) : l'administrateur transmet lui-même le mot de passe provisoire.
import { attemptKey } from "@/lib/auth/rate-limit";
import {
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import {
  AccountInputSchema,
  PasswordChangeSchema,
  RoleSchema,
} from "@/features/accounts/schemas";
import { recordAudit } from "../audit";
import { rawPrisma } from "../client";
import {
  InvalidOperationError,
  NotFoundError,
  rethrowUnique,
  WrongPasswordError,
} from "../errors";
import type { TenantDb } from "../tenant";
import type { Role } from "../types";

/** Adresse des comptes anonymisés : jamais réactivables. */
const ANONYMIZED_EMAIL = /@anonymise\.invalid$/;

export interface AccountView {
  id: string;
  email: string;
  role: Role;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  person: { id: string; name: string } | null;
}

export function accountsRepository(db: TenantDb, context: AccessContext) {
  async function findAccount(id: string) {
    const account = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, disabledAt: true },
    });
    if (!account) throw new NotFoundError("Compte");
    return account;
  }

  /** L'entreprise doit garder au moins un administrateur actif (sinon plus personne ne peut gérer les comptes). */
  async function assertAnotherActiveAdmin(excludedId: string) {
    const others = await db.user.count({
      where: { role: "ADMIN", disabledAt: null, id: { not: excludedId } },
    });
    if (others === 0)
      throw new InvalidOperationError(
        "L'entreprise doit garder au moins un administrateur actif",
      );
  }

  function assertNotSelf(id: string) {
    if (id === context.userId)
      throw new InvalidOperationError(
        "Un administrateur ne peut pas modifier son propre compte ici",
      );
  }

  return {
    async list(): Promise<AccountView[]> {
      assertPermission(context, "users:manage");
      const rows = await db.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          disabledAt: true,
          mustChangePassword: true,
          createdAt: true,
          person: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [
          { disabledAt: { sort: "asc", nulls: "first" } },
          { email: "asc" },
        ],
      });
      await recordAudit(db, context, {
        action: "user.list",
        resourceType: "User",
      });
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        disabled: row.disabledAt !== null,
        mustChangePassword: row.mustChangePassword,
        createdAt: row.createdAt,
        person: row.person
          ? {
              id: row.person.id,
              name: `${row.person.firstName} ${row.person.lastName}`,
            }
          : null,
      }));
    },

    /** Collaborateurs actifs sans compte : ceux qu'on peut rattacher à un nouveau compte. */
    async linkablePeople(): Promise<Array<{ id: string; name: string }>> {
      assertPermission(context, "users:manage");
      const people = await db.person.findMany({
        where: { status: "ACTIVE", user: null },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      return people.map((p) => ({
        id: p.id,
        name: `${p.lastName} ${p.firstName}`,
      }));
    },

    /** Crée un compte et renvoie son mot de passe provisoire, affiché UNE fois à l'administrateur. */
    async create(
      input: unknown,
    ): Promise<{ id: string; temporaryPassword: string }> {
      assertPermission(context, "users:manage");
      const data = AccountInputSchema.parse(input);
      if (data.personId) {
        const person = await db.person.findUnique({
          where: { id: data.personId },
          select: { status: true, user: { select: { id: true } } },
        });
        if (!person) throw new NotFoundError("Collaborateur");
        if (person.status !== "ACTIVE" || person.user)
          throw new InvalidOperationError(
            "Ce collaborateur est parti ou a déjà un compte",
          );
      }
      const temporaryPassword = generateTemporaryPassword();
      const account = await db.user
        .create({
          data: {
            organizationId: context.organizationId,
            email: data.email,
            role: data.role,
            personId: data.personId ?? null,
            passwordHash: await hashPassword(temporaryPassword),
            mustChangePassword: true,
          },
          select: { id: true },
        })
        .catch((error: unknown) => rethrowUnique(error, "email"));
      await recordAudit(db, context, {
        action: "user.create",
        resourceType: "User",
        resourceId: account.id,
      });
      return { id: account.id, temporaryPassword };
    },

    async setRole(id: string, role: unknown): Promise<void> {
      assertPermission(context, "users:manage");
      const next = RoleSchema.parse(role);
      assertNotSelf(id);
      const account = await findAccount(id);
      if (account.role === next) return;
      if (account.role === "ADMIN" && !account.disabledAt)
        await assertAnotherActiveAdmin(id);
      await db.user.update({ where: { id }, data: { role: next } });
      await recordAudit(db, context, {
        action: "user.role",
        resourceType: "User",
        resourceId: id,
      });
    },

    /** Désactive (connexion impossible, sessions coupées immédiatement) ou réactive un compte. */
    async setDisabled(id: string, disabled: boolean): Promise<void> {
      assertPermission(context, "users:manage");
      assertNotSelf(id);
      const account = await findAccount(id);
      if (disabled === (account.disabledAt !== null)) return;
      if (disabled && account.role === "ADMIN")
        await assertAnotherActiveAdmin(id);
      if (!disabled && ANONYMIZED_EMAIL.test(account.email))
        throw new InvalidOperationError(
          "Un compte anonymisé ne peut pas être réactivé",
        );
      await db.user.update({
        where: { id },
        data: { disabledAt: disabled ? new Date() : null },
      });
      await recordAudit(db, context, {
        action: disabled ? "user.disable" : "user.enable",
        resourceType: "User",
        resourceId: id,
      });
    },

    /** Nouveau mot de passe provisoire (perte du mot de passe) : renvoyé UNE fois, à changer à la connexion. */
    async resetPassword(id: string): Promise<{ temporaryPassword: string }> {
      assertPermission(context, "users:manage");
      assertNotSelf(id);
      const account = await findAccount(id);
      if (account.disabledAt)
        throw new InvalidOperationError("Réactivez d'abord ce compte");
      const temporaryPassword = generateTemporaryPassword();
      await db.user.update({
        where: { id },
        data: {
          passwordHash: await hashPassword(temporaryPassword),
          mustChangePassword: true,
        },
      });
      // Un compte verrouillé après des échecs redevient utilisable avec le nouveau mot de passe
      await rawPrisma.loginAttempt.deleteMany({
        where: { emailKey: attemptKey(account.email) },
      });
      await recordAudit(db, context, {
        action: "user.password.reset",
        resourceType: "User",
        resourceId: id,
      });
      return { temporaryPassword };
    },

    /** Chacun change son propre mot de passe (obligatoire après un mot de passe provisoire). */
    async changeOwnPassword(input: unknown): Promise<void> {
      assertPermission(context, "account:self");
      const data = PasswordChangeSchema.parse(input);
      const account = await db.user.findUnique({
        where: { id: context.userId },
        select: { passwordHash: true },
      });
      if (!account) throw new NotFoundError("Compte");
      if (!(await verifyPassword(account.passwordHash, data.current)))
        throw new WrongPasswordError();
      await db.user.update({
        where: { id: context.userId },
        data: {
          passwordHash: await hashPassword(data.next),
          mustChangePassword: false,
        },
      });
      await recordAudit(db, context, {
        action: "user.password.change",
        resourceType: "User",
        resourceId: context.userId,
      });
    },
  };
}
