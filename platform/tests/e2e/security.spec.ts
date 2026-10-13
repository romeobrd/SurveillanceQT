// Sécurité du navigateur : en-têtes, CSP respectée par toutes les pages, aucune requête hors de l'application.
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

const PAGES = [
  "/tableau-de-bord",
  "/carte",
  "/collaborateurs",
  "/postes",
  "/stock",
  "/materiel",
  "/projets",
  "/mes-donnees",
  "/administration",
  "/administration/demandes",
  "/administration/journal",
  "/administration/comptes",
  "/administration/abonnement",
  "/stock/reapprovisionnement",
  "/import/collaborateurs",
  "/mon-compte",
  "/cgu",
  "/confidentialite",
];

/** Observe une page : violations de CSP, erreurs de script et requêtes vers d'autres origines. */
function watch(page: Page) {
  const problems: string[] = [];
  const origin = "localhost";
  page.on("console", (message) => {
    const text = message.text();
    if (/content security policy|violates the following/i.test(text))
      problems.push(`CSP : ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`erreur : ${error.message}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["data:", "blob:"].includes(url.protocol) && url.hostname !== origin)
      problems.push(`requête externe : ${request.url()}`);
  });
  return problems;
}

test("en-têtes de sécurité présents, CSP sans origine externe", async ({
  request,
}) => {
  const headers = (await request.get("/login")).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
  const csp = headers["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/https?:\/\//); // aucune origine tierce
});

test("la page de connexion fonctionne sous la CSP stricte", async ({
  page,
}) => {
  const problems = watch(page);
  await login(page, "admin");
  expect(problems).toEqual([]);
});

test("toutes les pages se chargent sans violation de CSP ni requête externe", async ({
  page,
}) => {
  // Onze pages d'affilée, chacune compilée à la première visite en développement (dont la carte 3D)
  test.slow();
  const problems = watch(page);
  await login(page, "admin");
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("banner")).toBeVisible();
    if (path === "/carte")
      await expect(page.locator("canvas").first()).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test("les cookies de session sont httpOnly", async ({ page }) => {
  await login(page, "admin", ACCOUNTS);
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => /session-token/.test(cookie.name));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
});
