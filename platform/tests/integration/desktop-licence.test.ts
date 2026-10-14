// Activation et contrôle de l'application de bureau : abonnement payé exigé, administrateur seulement,
// jeton lié à son entreprise, journal d'audit, verrouillage après échecs.
import { beforeEach, describe, expect, it } from "vitest";
import { POST as activate } from "@/app/api/desktop/activation/route";
import { POST as verify } from "@/app/api/desktop/verification/route";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;
const PASSWORD = "Demo-Password-2026!";

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
  process.env.AUTH_SECRET ??= "secret-de-test-pour-les-licences-0123456789";
  await testRawPrisma.loginAttempt.deleteMany();
});

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
  it("donne un jeton et les informations de l'entreprise à un administrateur abonné, et journalise", async () => {
    await setSubscription(a.organizationId, "ACTIVE");
    const email = await emailOf(a.accounts.admin.userId);
    const response = await post(activate, { email, password: PASSWORD });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "active",
      licence: {
        organizationId: a.organizationId,
        plan: "pro",
        planName: "Pro",
        maxPeople: 50,
        admin: { email },
      },
    });
    expect(typeof body.token).toBe("string");
    expect(
      await testRawPrisma.auditLog.count({
        where: {
          organizationId: a.organizationId,
          action: "desktop.activation",
        },
      }),
    ).toBe(1);

    // Contrôle ultérieur : toujours actif, puis refusé dès que l'abonnement s'arrête
    expect((await post(verify, { token: body.token })).status).toBe(200);
    await setSubscription(a.organizationId, "CANCELED");
    const stopped = await post(verify, { token: body.token });
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

  it("verrouille après 5 échecs, même avec le bon mot de passe ensuite", async () => {
    await setSubscription(a.organizationId, "ACTIVE");
    const admin = await emailOf(a.accounts.admin.userId);
    for (let i = 0; i < 5; i++)
      await post(activate, { email: admin, password: "mauvais" });
    const locked = await post(activate, { email: admin, password: PASSWORD });
    expect(locked.status).toBe(429);
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
    expect((await post(verify, { token: `${body.token}x` })).status).toBe(401);
    await testRawPrisma.user.update({
      where: { id: a.accounts.admin.userId },
      data: { disabledAt: new Date() },
    });
    expect((await post(verify, { token: body.token })).status).toBe(403);
  });
});
