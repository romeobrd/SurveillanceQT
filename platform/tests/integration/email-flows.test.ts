// Liens envoyés par e-mail : usage unique, expiration, empreinte seule en base, aucune divulgation de comptes.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getRepositories } from "@/lib/db";
import { findAccessContext } from "@/lib/db/auth-store";
import {
  consumeEmailToken,
  createEmailToken,
  hashToken,
  isTokenValid,
  purgeEmailTokens,
  requestPasswordReset,
  sendVerificationEmail,
  setPasswordWithToken,
  verifyEmail,
} from "@/lib/db/email-flows";
import { sendTrialEmails } from "@/lib/db/trial-emails";
import { createOrganizationWithAdmin } from "@/lib/db/signup";
import { verifyPassword } from "@/lib/auth/password";
import { readOutbox } from "@/lib/email/send";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;

beforeEach(async () => {
  ({ a } = await prepareTwoOrganizations());
  // Le jeu de données commun contient un lien récent (qui déclencherait l'anti-abus)
  await testRawPrisma.emailToken.deleteMany();
  // Boîte d'envoi propre à chaque test (jamais celle du développement)
  process.env.EMAIL_OUTBOX_DIR = mkdtempSync(
    path.join(tmpdir(), "spacora-mails-"),
  );
});

const tokenIn = (text: string) =>
  /jeton=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";
const employee = () => ({
  id: a.accounts.employee.userId,
  organizationId: a.organizationId,
});

describe("liens à usage unique", () => {
  it("ne stocke que l'empreinte, sert une seule fois, et invalide les liens précédents", async () => {
    const first = await createEmailToken(employee(), "RESET_PASSWORD");
    const second = await createEmailToken(employee(), "RESET_PASSWORD");
    expect(
      await testRawPrisma.emailToken.count({ where: { tokenHash: second } }),
    ).toBe(0);
    expect(
      await testRawPrisma.emailToken.count({
        where: { tokenHash: hashToken(second) },
      }),
    ).toBe(1);
    expect(await consumeEmailToken(first, "RESET_PASSWORD")).toBeNull(); // remplacé par le second
    expect(await consumeEmailToken(second, "VERIFY_EMAIL")).toBeNull(); // mauvais usage
    expect(await consumeEmailToken(second, "RESET_PASSWORD")).toMatchObject({
      userId: employee().id,
    });
    expect(await consumeEmailToken(second, "RESET_PASSWORD")).toBeNull(); // déjà utilisé
  });

  it("expire", async () => {
    const now = new Date();
    const token = await createEmailToken(
      employee(),
      "RESET_PASSWORD",
      now,
      1000,
    );
    expect(
      await isTokenValid(
        token,
        "RESET_PASSWORD",
        new Date(now.getTime() + 500),
      ),
    ).toBe(true);
    expect(
      await consumeEmailToken(
        token,
        "RESET_PASSWORD",
        new Date(now.getTime() + 2000),
      ),
    ).toBeNull();
    expect(
      await purgeEmailTokens(new Date(now.getTime() + 2000)),
    ).toBeGreaterThanOrEqual(1);
  });

  it("refuse les jetons vides ou démesurés", async () => {
    expect(await consumeEmailToken("", "INVITE")).toBeNull();
    expect(await isTokenValid("x".repeat(500), "INVITE")).toBe(false);
  });
});

describe("mot de passe oublié", () => {
  it("envoie un lien qui permet de choisir un nouveau mot de passe, une seule fois", async () => {
    await requestPasswordReset(a.accounts.employee.email.toUpperCase());
    const [mail] = await readOutbox();
    expect(mail.to).toBe(a.accounts.employee.email);
    const token = tokenIn(mail.text);
    const email = await setPasswordWithToken(
      token,
      "RESET_PASSWORD",
      "une-nouvelle-phrase",
    );
    expect(email).toBe(a.accounts.employee.email);
    const user = await testRawPrisma.user.findUniqueOrThrow({
      where: { id: employee().id },
    });
    expect(await verifyPassword(user.passwordHash, "une-nouvelle-phrase")).toBe(
      true,
    );
    expect(
      await setPasswordWithToken(token, "RESET_PASSWORD", "encore-une-autre"),
    ).toBeNull();
    expect(
      await testRawPrisma.auditLog.count({
        where: { action: "user.password.reset.self" },
      }),
    ).toBe(1);
  });

  it("ne révèle rien et n'envoie rien pour un compte inconnu ou désactivé, ni deux fois de suite", async () => {
    await requestPasswordReset("inconnu@nulle-part.test");
    await testRawPrisma.user.update({
      where: { id: a.accounts.manager.userId },
      data: { disabledAt: new Date() },
    });
    await requestPasswordReset(a.accounts.manager.email);
    expect(await readOutbox()).toHaveLength(0);
    await requestPasswordReset(a.accounts.employee.email);
    await requestPasswordReset(a.accounts.employee.email);
    expect(await readOutbox()).toHaveLength(1); // anti-abus : deux minutes entre deux envois
  });
});

describe("confirmation d'adresse à l'inscription", () => {
  it("envoie le lien, confirme l'adresse, n'envoie plus rien ensuite", async () => {
    const { userId } = await createOrganizationWithAdmin({
      company: "Agence Horizon",
      firstName: "Lina",
      lastName: "Martin",
      email: "lina@horizon.test",
      password: "une-phrase-de-passe",
      acceptTerms: "on",
      website: "",
    });
    expect((await findAccessContext(userId))?.emailVerified).toBe(false);
    expect(await sendVerificationEmail(userId)).toBe("sent");
    expect(await sendVerificationEmail(userId)).toBe("throttled");
    const [mail] = await readOutbox();
    expect(mail.text).toContain("Lina");
    expect(await verifyEmail(tokenIn(mail.text))).toBe(true);
    expect((await findAccessContext(userId))?.emailVerified).toBe(true);
    expect(await sendVerificationEmail(userId)).toBe("already");
  });
});

describe("invitation par l'administrateur", () => {
  it("crée le compte sans mot de passe connu ; la personne choisit le sien via le lien", async () => {
    const accounts = getRepositories(a.accounts.admin.context).accounts;
    const created = await accounts.create(
      { email: "nouveau@exemple.test", role: "EMPLOYEE" },
      { invite: true },
    );
    expect(created.temporaryPassword).toBeUndefined();
    const listed = (await accounts.list()).find(
      (account) => account.id === created.id,
    );
    expect(listed).toMatchObject({
      invitationPending: true,
      mustChangePassword: false,
    });
    expect(
      await setPasswordWithToken(
        created.inviteToken!,
        "INVITE",
        "ma-phrase-a-moi-1",
      ),
    ).toBe("nouveau@exemple.test");
    const user = await testRawPrisma.user.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await verifyPassword(user.passwordHash, "ma-phrase-a-moi-1")).toBe(
      true,
    );
    expect(
      (await accounts.list()).find((account) => account.id === created.id)
        ?.invitationPending,
    ).toBe(false);
  });

  it("un lien de réinitialisation envoyé par l'admin remplace le mot de passe provisoire", async () => {
    const reset = await getRepositories(
      a.accounts.admin.context,
    ).accounts.resetPassword(employee().id, { byEmail: true });
    expect(reset.temporaryPassword).toBeUndefined();
    expect(await isTokenValid(reset.resetToken!, "RESET_PASSWORD")).toBe(true);
  });
});

describe("rappels de fin d'essai", () => {
  it("écrit aux administrateurs actifs, une seule fois", async () => {
    const now = new Date();
    const state = {
      id: a.organizationId,
      name: a.name,
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(now.getTime() + 2 * 86_400_000),
      trialReminderSentAt: null,
      trialEndedNoticeAt: null,
    };
    expect(await sendTrialEmails(state, now)).toBe(1);
    const [mail] = await readOutbox();
    expect(mail.to).toBe(a.accounts.admin.email);
    expect(mail.subject).toContain("2 jour");
    const after = await testRawPrisma.organization.findUniqueOrThrow({
      where: { id: a.organizationId },
    });
    expect(
      await sendTrialEmails(
        { ...state, trialReminderSentAt: after.trialReminderSentAt },
        now,
      ),
    ).toBe(0);
  });
});
