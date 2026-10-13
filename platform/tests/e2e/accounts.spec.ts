// Comptes : création par l'admin, mot de passe provisoire obligatoirement changé, désactivation.
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, login, logout, uniqueId } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  execSync("npm run db:seed:e2e", { stdio: "pipe" });
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("l'admin crée un compte ; la personne doit changer son mot de passe provisoire avant tout", async ({
  page,
}) => {
  const email = `compte.${uniqueId()}@atelier-e2e.example`;
  await login(page, "admin", E2E_ACCOUNTS);
  await page.goto("/administration/comptes");
  const form = page.getByRole("region", { name: "Nouveau compte" });
  await form.getByLabel("E-mail de connexion").fill(email);
  await form.getByLabel("Rôle").selectOption("EMPLOYEE");
  await form.getByRole("button", { name: "Créer le compte" }).click();
  const shown = form.getByTestId("temporary-password");
  await expect(shown).toContainText(email);
  const temporary = (await shown.locator("p.font-mono").innerText()).trim();
  expect(temporary).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  await expect(
    page.getByRole("row", { name: new RegExp(email) }),
  ).toContainText("Mot de passe provisoire");
  await logout(page);

  // Première connexion : tout renvoie vers « Mon compte »
  await signIn(page, email, temporary);
  await expect(page).toHaveURL(/\/mon-compte/);
  await expect(
    page.getByText("Vous utilisez un mot de passe provisoire"),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }),
  ).toHaveCount(0);
  await page.goto("/stock");
  await expect(page).toHaveURL(/\/mon-compte/);

  await page.getByLabel("Mot de passe actuel").fill(temporary);
  await page.getByLabel(/Nouveau mot de passe/).fill("Ma-phrase-secrete-2026");
  await page
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill("Ma-phrase-secrete-2026");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText("Mot de passe changé.")).toBeVisible();
  await page.goto("/stock");
  await expect(page).toHaveURL(/\/stock/);
  await logout(page);

  // L'ancien mot de passe provisoire ne fonctionne plus, le nouveau oui
  await signIn(page, email, temporary);
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, email, "Ma-phrase-secrete-2026");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});

test("un compte désactivé ne peut plus se connecter ; un employé n'accède pas aux comptes", async ({
  page,
  browser,
}) => {
  await login(page, "admin", E2E_ACCOUNTS);
  await page.goto("/administration/comptes");
  const row = page.getByRole("row", {
    name: new RegExp(E2E_ACCOUNTS.employee),
  });
  await row.getByRole("button", { name: "Désactiver" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmer" })
    .click();
  await expect(row).toContainText("Désactivé");

  const other = await (await browser.newContext()).newPage();
  await signIn(other, E2E_ACCOUNTS.employee, "Demo-Password-2026!");
  await expect(other).toHaveURL(/\/login/);

  await row.getByRole("button", { name: "Réactiver" }).click();
  await expect(row).toContainText("Actif");
  await login(other, "employee", E2E_ACCOUNTS);
  await other.goto("/administration/comptes");
  await expect(other).toHaveURL(/\/tableau-de-bord/);
});
