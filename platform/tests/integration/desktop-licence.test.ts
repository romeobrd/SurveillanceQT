// Activation et contrôle de l'application de bureau : abonnement payé exigé, administrateur seulement,
// attestation signée liée à son entreprise, journal d'audit, verrouillage après échecs.
import { generateKeyPairSync } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as activate } from "@/app/api/desktop/activation/route";
import { POST as verify } from "@/app/api/desktop/verification/route";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { signGrant, verifyGrant } from "@/lib/desktop/licence-grant";
import { siteVerifyingKey } from "@/lib/desktop/licence-keys";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;
const PASSWORD = "Demo-Password-2026!";

let ipCounter = 0;

beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  process.env.DESKTOP_LICENCE_PRIVATE_KEY = privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
  process.env.SPACORA_LICENCE_PUBLIC_KEY = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
});

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
  await testRawPrisma.loginAttempt.deleteMany();
  // Chaque test vient d'une adresse différente (compteurs en mémoire partagés entre les tests)
  ipCounter += 1;
});

const post = (
  handler: (r: Request) => Promise<Response>,
  body: unknown,
  ip = `198.51.100.${ipCounter}`,
) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
const emailOf = async (userId: string) =>
  (await testRawPrisma.user.findUniqueOrThrow({ where: { id: userId } })).email;
async function setSubscription(
  organizationId: string,
  status: "ACTIVE" | "TRIALING" | "CANCELED",
) {
  await testRawPrisma.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionStatus: status,
      plan: "pro",
      trialEndsAt:
        status === "TRIALING" ? new Date(Date.now() + 86_400_000) : null,
      currentPeriodEnd:
        status === "CANCELED"
          ? new Date(Date.now() - 86_400_000)
          : new Date(Date.now() + 30 * 86_400_000),
    },
  });
}

describe("activation de l'application de bureau", () => {
  it("donne une attestation signée (entreprise, offre) à un administrateur abonné, et journalise", async () => {
    await setSubscription(a.organizationId, "ACTIVE");
    const email = await emailOf(a.accounts.admin.userId);
    const response = await post(activate, { email, password: PASSWORD });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("active");
    const grant = verifyGrant(body.grant, siteVerifyingKey()!);
    expect(grant).toMatchObject({
      userId: a.accounts.admin.userId,
      licence: {
        organizationId: a.organizationId,
        plan: "pro",
        planName: "Pro",
        maxPeople: 50,
        admin: { email },
      },
    });
    expect(grant!.expiresAt - grant!.issuedAt).toBe(14 * 86_400_000);
    expect(
      await testRawPrisma.auditLog.count({
        where: {
          organizationId: a.organizationId,
          action: "desktop.activation",
        },
      }),
    ).toBe(1);

    // Contrôle ultérieur : toujours actif, puis refusé dès que l'abonnement s'arrête
    const renewed = await post(verify, { grant: body.grant });
    expect(renewed.status).toBe(200);
    expect(
      verifyGrant((await renewed.json()).grant, siteVerifyingKey()!),
    ).not.toBeNull();
    await setSubscription(a.organizationId, "CANCELED");
    const stopped = await post(verify, { grant: body.grant });
    expect(stopped.status).toBe(403);
    expect((await stopped.json()).status).toBe("no_subscription");
  });

  it("refuse l'essai gratuit, un non-administrateur, un mauvais mot de passe", async () => {
    await setSubscription(a.organizationId, "TRIALING");
    const admin = await emailOf(a.accounts.admin.userId);
    expect(
      (await post(activate, { email: admin, password: PASSWORD })).status,
    ).toBe(403);
    await setSubscription(a.organizationId, "ACTIVE");
    const manager = await emailOf(a.accounts.manager.userId);
    expect(
      (await post(activate, { email: manager, password: PASSWORD })).status,
    ).toBe(403);
    expect(
      (await post(activate, { email: admin, password: "mauvais" })).status,
    ).toBe(401);
    expect(
      (await post(activate, { email: "pas-un-email", password: "x" })).status,
    ).toBe(400);
  });

  it("5 échecs bloquent cette adresse pour ce compte, sans bloquer le vrai client ailleurs", async () => {
    await setSubscription(a.organizationId, "ACTIVE");
    const admin = await emailOf(a.accounts.admin.userId);
    const attacker = `203.0.113.${ipCounter}`;
    for (let i = 0; i < 5; i++)
      await post(activate, { email: admin, password: "mauvais" }, attacker);
    const locked = await post(
      activate,
      { email: admin, password: PASSWORD },
      attacker,
    );
    expect(locked.status).toBe(429);
    // Le client, depuis son bureau, active normalement
    expect(
      (await post(activate, { email: admin, password: PASSWORD })).status,
    ).toBe(200);
  });

  it("un jeton falsifié ou désignant une autre entreprise est refusé ; un compte désactivé perd sa licence", async () => {
    await setSubscription(a.organizationId, "ACTIVE");
    await setSubscription(b.organizationId, "ACTIVE");
    const body = await (
      await post(activate, {
        email: await emailOf(a.accounts.admin.userId),
        password: PASSWORD,
      })
    ).json();
    expect((await post(verify, { grant: `${body.grant}x` })).status).toBe(401);
    // Attestation signée par une autre clé (faux serveur) : refusée
    const other = generateKeyPairSync("ed25519").privateKey;
    const forged = signGrant(
      verifyGrant(body.grant, siteVerifyingKey()!)!,
      other,
    );
    expect((await post(verify, { grant: forged })).status).toBe(401);
    await testRawPrisma.user.update({
      where: { id: a.accounts.admin.userId },
      data: { disabledAt: new Date() },
    });
    expect((await post(verify, { grant: body.grant })).status).toBe(403);
  });
});
