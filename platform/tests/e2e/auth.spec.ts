import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, login } from "./helpers";

test("sans session, la carte redirige vers la connexion", async ({ page }) => {
  await page.goto("/carte?seed=5");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("un mauvais mot de passe est refusé sans révéler si le compte existe", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Adresse e-mail professionnelle")
    .fill(ACCOUNTS.manager);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("login-error")).toHaveText(/incorrect/);
  const known = await page.getByTestId("login-error").innerText();

  await page
    .getByLabel("Adresse e-mail professionnelle")
    .fill(`inconnu-${Date.now()}@exemple.example`);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("login-error")).toHaveText(known);
  await expect(page).toHaveURL(/\/login/);
});

test("connexion, carte, puis déconnexion", async ({ page }) => {
  await login(page, "manager");
  await expect(page.getByTestId("role")).toHaveText("Manager");
  await expect(page.getByText("Atelier Lumière (démo A)")).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/carte");
  await expect(page).toHaveURL(/\/login/);
});

test("le rôle affiché vient du compte : l'employé n'a pas d'actions rapides", async ({
  page,
}) => {
  await login(page, "employee");
  await expect(page.getByTestId("role")).toHaveText("Employé");
  await page.goto("/carte");
  await page.getByRole("complementary").getByRole("button").first().click();
  await expect(
    page.getByRole("heading", { name: "Postes de travail", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Actions rapides" }),
  ).toHaveCount(0);
});

test("le manager voit les actions rapides", async ({ page }) => {
  await login(page, "manager");
  await page.goto("/carte");
  await page.getByRole("complementary").getByRole("button").first().click();
  await expect(
    page.getByRole("heading", { name: "Actions rapides" }),
  ).toBeVisible();
});

test("la page de connexion renvoie vers le tableau de bord quand on est déjà connecté", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});

test("verrouillage après 5 échecs, même pour un compte inconnu", async ({
  page,
}) => {
  const email = `bloque-${Date.now()}@exemple.example`;
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Adresse e-mail professionnelle").fill(email);
    await page.getByLabel("Mot de passe").fill(`essai-${i}`);
    await page.getByRole("button", { name: "Se connecter" }).click();
    // Le mot de passe est vidé quand l'action est terminée
    await expect(page.getByLabel("Mot de passe")).toHaveValue("");
    await expect(page.getByTestId("login-error")).toContainText("incorrect");
  }
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("login-error")).toContainText(
    "Trop de tentatives",
  );
});

test("le cookie de session est httpOnly et sameSite=lax", async ({
  page,
  context,
}) => {
  await login(page, "manager");
  const session = (await context.cookies()).find((cookie) =>
    cookie.name.includes("session-token"),
  );
  expect(session).toBeDefined();
  expect(session!.httpOnly).toBe(true);
  expect(session!.sameSite).toBe("Lax");
});
