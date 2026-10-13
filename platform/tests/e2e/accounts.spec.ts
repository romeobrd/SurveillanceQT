// Comptes : invitation par e-mail, lien de réinitialisation, mot de passe provisoire à changer, désactivation.
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, login, logout, uniqueId } from "./helpers";
import { lastLinkTo } from "./mailbox";

// Chaque test recrée l'entreprise de test et calcule plusieurs empreintes de mot de passe (volontairement lentes)
test.describe.configure({ mode: "serial", timeout: 60_000 });

test.beforeEach(() => {
  execSync("npm run db:seed:e2e", { stdio: "pipe" });
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("l'admin invite un collègue par e-mail ; la personne choisit son mot de passe", async ({
  page,
}) => {
  const email = `compte.${uniqueId()}@atelier-e2e.example`;
  await login(page, "admin", E2E_ACCOUNTS);
  await page.goto("/administration/comptes");
  const form = page.getByRole("region", { name: "Nouveau compte" });
  await form.getByLabel("E-mail de connexion").fill(email);
  await form.getByLabel("Rôle").selectOption("EMPLOYEE");
  await form.getByRole("button", { name: "Créer le compte" }).click();
  await expect(form.getByTestId("account-notice")).toContainText(
    `Invitation envoyée à ${email}`,
  );
  // Aucun mot de passe n'est montré à l'admin
  await expect(form.getByTestId("temporary-password")).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: new RegExp(email) }),
  ).toContainText("Invitation en attente");
  await logout(page);

  // Le lien d'invitation active le compte et connecte la personne
  await page.goto(await lastLinkTo(email, /Invitation/));
  await expect(
    page.getByRole("heading", { name: "Activer votre compte" }),
  ).toBeVisible();
  await page.getByLabel(/Nouveau mot de passe/).fill("Ma-phrase-secrete-2026");
  await page
    .getByLabel("Confirmer le mot de passe")
    .fill("Ma-phrase-secrete-2026");
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  await logout(page);
  await signIn(page, email, "Ma-phrase-secrete-2026");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});

test("l'admin envoie un lien de réinitialisation ; le nouveau mot de passe remplace l'ancien", async ({
  page,
}) => {
  await login(page, "admin", E2E_ACCOUNTS);
  await page.goto("/administration/comptes");
  const row = page.getByRole("row", {
    name: new RegExp(E2E_ACCOUNTS.manager),
  });
  await row
    .getByRole("button", { name: "Envoyer un lien de réinitialisation" })
    .click();
  await expect(row.getByTestId("account-notice")).toContainText(
    "Lien de réinitialisation envoyé",
  );
  await logout(page);

  await page.goto(await lastLinkTo(E2E_ACCOUNTS.manager, /Réinitialisation/));
  await page.getByLabel(/Nouveau mot de passe/).fill("Nouvelle-phrase-2026");
  await page
    .getByLabel("Confirmer le mot de passe")
    .fill("Nouvelle-phrase-2026");
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  await logout(page);
  await signIn(page, E2E_ACCOUNTS.manager, "Demo-Password-2026!");
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, E2E_ACCOUNTS.manager, "Nouvelle-phrase-2026");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});

test("avec un mot de passe provisoire, la personne doit le changer avant tout", async ({
  page,
}) => {
  const temporary = "Prov-isoi-reXX-2026";
  execSync(
    `npm run e2e:tools -- temporary-password ${E2E_ACCOUNTS.employee} ${temporary}`,
    { stdio: "pipe" },
  );
  await signIn(page, E2E_ACCOUNTS.employee, temporary);
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
  await signIn(page, E2E_ACCOUNTS.employee, temporary);
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, E2E_ACCOUNTS.employee, "Ma-phrase-secrete-2026");
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
