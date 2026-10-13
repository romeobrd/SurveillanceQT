// Liens envoyés par e-mail (confirmation d'adresse, mot de passe oublié, invitation) : utilisés AVANT ou SANS session.
// Seule l'empreinte SHA-256 du lien est stockée ; un lien ne sert qu'une fois et expire.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { attemptKey } from "@/lib/auth/rate-limit";
import { appBaseUrl, emailAvailable, sendEmail } from "@/lib/email/send";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/email/templates";
import { rawPrisma } from "./client";

export type TokenPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD" | "INVITE";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  VERIFY_EMAIL: 48 * 3_600_000,
  RESET_PASSWORD: 3_600_000,
  INVITE: 7 * 24 * 3_600_000,
};

/** Délai minimal entre deux e-mails du même type pour un même compte (anti-abus). */
export const RESEND_DELAY_MS = 2 * 60_000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crée un lien à usage unique (et invalide les précédents du même type pour ce compte).
 * Renvoie le jeton en clair : il n'existe que dans l'e-mail.
 */
export async function createEmailToken(
  user: { id: string; organizationId: string },
  purpose: TokenPurpose,
  now: Date = new Date(),
  ttlMs: number = TOKEN_TTL_MS[purpose],
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await rawPrisma.$transaction([
    rawPrisma.emailToken.updateMany({
      where: { userId: user.id, purpose, usedAt: null },
      data: { usedAt: now },
    }),
    rawPrisma.emailToken.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + ttlMs),
      },
    }),
  ]);
  return token;
}

/** Le lien est-il encore valable (sans le consommer) ? Pour afficher le bon formulaire. */
export async function isTokenValid(
  token: string,
  purpose: TokenPurpose,
  now: Date = new Date(),
): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const row = await rawPrisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { purpose: true, usedAt: true, expiresAt: true },
  });
  return !!row && row.purpose === purpose && !row.usedAt && row.expiresAt > now;
}

/** Consomme un lien (une seule fois, de façon atomique) ; renvoie le compte concerné ou null. */
export async function consumeEmailToken(
  token: string,
  purpose: TokenPurpose,
  now: Date = new Date(),
): Promise<{ userId: string; organizationId: string } | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const claimed = await rawPrisma.emailToken.updateMany({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  const row = await rawPrisma.emailToken.findUniqueOrThrow({
    where: { tokenHash },
    select: { userId: true, organizationId: true },
  });
  return row;
}

async function recentlySent(userId: string, purpose: TokenPurpose, now: Date) {
  const last = await rawPrisma.emailToken.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return !!last && now.getTime() - last.createdAt.getTime() < RESEND_DELAY_MS;
}

async function audit(
  organizationId: string,
  actorId: string | null,
  action: string,
  userId: string,
) {
  await rawPrisma.auditLog.create({
    data: {
      organizationId,
      actorId,
      action,
      resourceType: "User",
      resourceId: userId,
    },
  });
}

/** Envoie (ou renvoie) le lien de confirmation d'adresse. Sans effet si l'adresse est déjà confirmée. */
export async function sendVerificationEmail(
  userId: string,
  now: Date = new Date(),
): Promise<"sent" | "already" | "throttled" | "unavailable"> {
  if (!emailAvailable()) return "unavailable";
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      email: true,
      emailVerifiedAt: true,
      person: { select: { firstName: true } },
    },
  });
  if (!user || user.emailVerifiedAt) return "already";
  if (await recentlySent(user.id, "VERIFY_EMAIL", now)) return "throttled";
  const token = await createEmailToken(user, "VERIFY_EMAIL", now);
  await sendEmail(
    user.email,
    verifyEmailTemplate({
      firstName: user.person?.firstName ?? "",
      url: `${appBaseUrl()}/verifier-email?jeton=${token}`,
    }),
  );
  return "sent";
}

export async function verifyEmail(
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  const owner = await consumeEmailToken(token, "VERIFY_EMAIL", now);
  if (!owner) return false;
  await rawPrisma.user.update({
    where: { id: owner.userId },
    data: { emailVerifiedAt: now },
  });
  await audit(
    owner.organizationId,
    owner.userId,
    "user.email.verify",
    owner.userId,
  );
  return true;
}

/**
 * Mot de passe oublié : la réponse est toujours la même pour l'appelant (on ne révèle jamais si un compte existe).
 * Rien n'est envoyé pour un compte inconnu, désactivé ou anonymisé, ni deux fois en moins de deux minutes.
 */
export async function requestPasswordReset(
  email: string,
  now: Date = new Date(),
): Promise<void> {
  if (!emailAvailable()) return;
  const user = await rawPrisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, organizationId: true, email: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return;
  if (await recentlySent(user.id, "RESET_PASSWORD", now)) return;
  const token = await createEmailToken(user, "RESET_PASSWORD", now);
  await sendEmail(
    user.email,
    resetPasswordTemplate({
      url: `${appBaseUrl()}/reinitialiser?jeton=${token}`,
    }),
  );
  await audit(
    user.organizationId,
    null,
    "user.password.reset.request",
    user.id,
  );
}

/**
 * Nouveau mot de passe depuis un lien (mot de passe oublié ou invitation). Le lien prouve aussi l'accès à la
 * boîte mail : l'adresse est confirmée. Renvoie l'e-mail du compte (pour la connexion), ou null si le lien est invalide.
 */
export async function setPasswordWithToken(
  token: string,
  purpose: "RESET_PASSWORD" | "INVITE",
  password: string,
  now: Date = new Date(),
): Promise<string | null> {
  const owner = await consumeEmailToken(token, purpose, now);
  if (!owner) return null;
  const user = await rawPrisma.user.findUnique({
    where: { id: owner.userId },
    select: { email: true, disabledAt: true, emailVerifiedAt: true },
  });
  if (!user || user.disabledAt) return null;
  await rawPrisma.user.update({
    where: { id: owner.userId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      emailVerifiedAt: user.emailVerifiedAt ?? now,
    },
  });
  // Un compte verrouillé après des échecs redevient utilisable
  await rawPrisma.loginAttempt.deleteMany({
    where: { emailKey: attemptKey(user.email) },
  });
  await audit(
    owner.organizationId,
    owner.userId,
    purpose === "INVITE"
      ? "user.invitation.accept"
      : "user.password.reset.self",
    owner.userId,
  );
  return user.email;
}

/** Purge : liens expirés ou utilisés depuis plus d'un jour (rien d'utile à garder). */
export async function purgeEmailTokens(
  now: Date = new Date(),
): Promise<number> {
  const result = await rawPrisma.emailToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { usedAt: { lt: new Date(now.getTime() - 86_400_000) } },
      ],
    },
  });
  return result.count;
}
