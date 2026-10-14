// Licence côté application de bureau : seul le site Spacora peut l'accorder. Faux serveur, fichier modifié,
// horloge remise en arrière et bascule vers une autre entreprise sont refusés.
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { POST as activate } from "@/app/api/desktop/activation/route";
import { POST as verify } from "@/app/api/desktop/verification/route";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import {
  activateLicence,
  currentLicence,
  readStoredLicence,
} from "@/lib/desktop/licence-store";
import { prepareTwoOrganizations } from "../support/fixtures";

const PASSWORD = "Demo-Password-2026!";
const SITE = "https://site.exemple";
let a: FullFixture;
let b: FullFixture;
/** Réponse du « serveur » contacté par l'application : le vrai site, sauf si un test la remplace. */
let fakeServer: ((route: string, body: unknown) => unknown) | null = null;

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
  for (const id of [a.organizationId, b.organizationId])
    await testRawPrisma.organization.update({
      where: { id },
      data: {
        subscriptionStatus: "ACTIVE",
        plan: "pro",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
  process.env.SPACORA_DATA_DIR = await mkdtemp(path.join(tmpdir(), "licence-"));
  fakeServer = null;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const route = new URL(url).pathname;
    const body = JSON.parse(String(init.body));
    if (fakeServer) return Response.json(fakeServer(route, body));
    const handler = route === "/api/desktop/activation" ? activate : verify;
    return handler(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  });
});

afterEach(() => vi.unstubAllGlobals());

const emailOf = async (userId: string) =>
  (await testRawPrisma.user.findUniqueOrThrow({ where: { id: userId } })).email;
const licenceFile = () =>
  path.join(process.env.SPACORA_DATA_DIR!, "licence.json");

describe("licence de l'application de bureau", () => {
  it("s'active avec le vrai site et reste valide", async () => {
    const email = await emailOf(a.accounts.admin.userId);
    expect(await activateLicence(email, PASSWORD, SITE)).toBe("active");
    const state = await currentLicence();
    expect(state.state).toBe("valid");
    if (state.state === "valid")
      expect(state.grant.licence.organizationId).toBe(a.organizationId);
  });

  it("refuse un faux serveur qui répond « actif »", async () => {
    fakeServer = () => ({
      status: "active",
      grant: "eyJ2IjoyfQ.c2lnbmF0dXJl",
      licence: { plan: "business" },
    });
    expect(await activateLicence("x@y.fr", "peu-importe", SITE)).toBe("forged");
    expect(await readStoredLicence()).toBeNull();
  });

  it("un fichier de licence modifié n'est plus valable", async () => {
    await activateLicence(
      await emailOf(a.accounts.admin.userId),
      PASSWORD,
      SITE,
    );
    const stored = JSON.parse(await readFile(licenceFile(), "utf8"));
    const [body, signature] = stored.grant.split(".");
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    data.e += 365 * 86_400_000;
    data.l.plan = "business";
    stored.grant = `${Buffer.from(JSON.stringify(data)).toString("base64url")}.${signature}`;
    await writeFile(licenceFile(), JSON.stringify(stored));
    expect((await currentLicence()).state).toBe("invalid");
  });

  it("une horloge remise en arrière est détectée", async () => {
    await activateLicence(
      await emailOf(a.accounts.admin.userId),
      PASSWORD,
      SITE,
    );
    const yesterday = new Date(Date.now() - 86_400_000);
    expect((await currentLicence(yesterday)).state).toBe("clock");
    // Date constatée plus tard, puis retour en arrière de deux jours
    const later = new Date(Date.now() + 5 * 86_400_000);
    fakeServer = () => ({ status: "offline" });
    expect((await currentLicence(later)).state).toBe("valid");
    expect(
      (await currentLicence(new Date(later.getTime() - 2 * 86_400_000))).state,
    ).toBe("clock");
  });

  it("sans Internet, valable 14 jours après le dernier contrôle, puis bloquée", async () => {
    await activateLicence(
      await emailOf(a.accounts.admin.userId),
      PASSWORD,
      SITE,
    );
    fakeServer = () => {
      throw new Error("pas de réseau");
    };
    const day = (n: number) => new Date(Date.now() + n * 86_400_000);
    expect((await currentLicence(day(13))).state).toBe("valid");
    expect((await currentLicence(day(15))).state).toBe("offline_expired");
  });

  it("ne bascule pas les données de ce PC vers le compte d'une autre entreprise", async () => {
    await activateLicence(
      await emailOf(a.accounts.admin.userId),
      PASSWORD,
      SITE,
    );
    // Les entreprises de la base de test tiennent lieu de l'entreprise locale déjà créée
    expect(
      await activateLicence(
        await emailOf(b.accounts.admin.userId),
        PASSWORD,
        SITE,
      ),
    ).toBe("other_organization");
    // Même entreprise : réactivation possible
    expect(
      await activateLicence(
        await emailOf(a.accounts.admin.userId),
        PASSWORD,
        SITE,
      ),
    ).toBe("active");
  });
});
