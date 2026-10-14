// Comptes : invitation par e-mail, lien de réinitialisation, mot de passe provisoire à changer, désactivation.
// Chaque test crée sa propre entreprise par l'inscription : l'entreprise de test commune est recréée
// par d'autres fichiers en parallèle, et ses comptes servent à d'autres tests.
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { logout, uniqueId } from "./helpers";
import { lastLinkTo } from "./mailbox";

// Plusieurs empreintes de mot de passe par test (volontairement lentes)
test.describe.configure({ timeout: 60_000 });

const ADMIN_PASSWORD = "une-phrase-de-passe";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/**
 * Inscrit une nouvelle entreprise et confirme l'adresse de l'administrateur (exigée pour inviter par e-mail) ;
 * la page reste connectée avec son administrateur.
 */
async function signUpCompany(page: Page): Promise<string> {
  const email = `admin.${uniqueId()}@horizon.example`;
  await page.goto("/inscription");
  await page.getByLabel("Nom de l'entreprise").fill(`Agence ${uniqueId()}`);
  await page.getByLabel("Votre prénom").fill("Noa");
  await page.getByLabel("Votre nom").fill("Petit");
  await page.getByLabel("Votre e-mail professionnel").fill(email);
  await page.getByLabel(/Mot de passe/).fill(ADMIN_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Démarrer l'essai gratuit" }).click();
  await expect(page).toHaveURL(/\/carte/);
  await page.goto(await lastLinkTo(email, /Confirmez votre adresse/));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page.getByText("Adresse confirmée, merci !")).toBeVisible();
  return email;
}

/** Depuis la session de l'administrateur : crée un compte (invitation envoyée par e-mail). */
async function inviteAccount(
  page: Page,
  role: "MANAGER" | "EMPLOYEE",
): Promise<string> {
  const email = `compte.${uniqueId()}@horizon.example`;
  await page.goto("/administration/comptes");
  const form = page.getByRole("region", { name: "Nouveau compte" });
  await form.getByLabel("E-mail de connexion").fill(email);
  await form.getByLabel("Rôle").selectOption(role);
  await form.getByRole("button", { name: "Créer le compte" }).click();
  await expect(form.getByTestId("account-notice")).toContainText(
    `Invitation envoyée à ${email}`,
  );
  return email;
}

/** Ouvre le lien d'invitation reçu et choisit le mot de passe (la personne est alors connectée). */
async function acceptInvitation(page: Page, email: string, password: string) {
  await page.goto(await lastLinkTo(email, /Invitation/));
  await expect(
    page.getByRole("heading", { name: "Activer votre compte" }),
  ).toBeVisible();
  await page.getByLabel(/Nouveau mot de passe/).fill(password);
  await page.getByLabel("Confirmer le mot de passe").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
}

test("l'admin invite un collègue par e-mail ; la personne choisit son mot de passe", async ({
  page,
}) => {
  await signUpCompany(page);
  const email = await inviteAccount(page, "EMPLOYEE");
  // Aucun mot de passe n'est montré à l'admin
  await expect(page.getByTestId("temporary-password")).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: new RegExp(email) }),
  ).toContainText("Invitation en attente");
  await logout(page);

  await acceptInvitation(page, email, "Ma-phrase-secrete-2026");
  await logout(page);
  await signIn(page, email, "Ma-phrase-secrete-2026");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});

test("l'admin envoie un lien de réinitialisation ; le nouveau mot de passe fonctionne", async ({
  page,
}) => {
  await signUpCompany(page);
  const email = await inviteAccount(page, "MANAGER");
  const row = page.getByRole("row", { name: new RegExp(email) });
  await row
    .getByRole("button", { name: "Envoyer un lien de réinitialisation" })
    .click();
  await expect(row.getByTestId("account-notice")).toContainText(
    "Lien de réinitialisation envoyé",
  );
  await logout(page);

  await page.goto(await lastLinkTo(email, /Réinitialisation/));
  await page.getByLabel(/Nouveau mot de passe/).fill("Nouvelle-phrase-2026");
  await page
    .getByLabel("Confirmer le mot de passe")
    .fill("Nouvelle-phrase-2026");
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  await logout(page);
  await signIn(page, email, "Nouvelle-phrase-2026");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});

test("avec un mot de passe provisoire, la personne doit le changer avant tout", async ({
  page,
}) => {
  const email = await signUpCompany(page);
  await logout(page);
  const temporary = "Prov-isoi-reXX-2026";
  execSync(`npm run e2e:tools -- temporary-password ${email} ${temporary}`, {
    stdio: "pipe",
  });
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
  const admin = await signUpCompany(page);
  const employee = await inviteAccount(page, "EMPLOYEE");
  await logout(page);
  await acceptInvitation(page, employee, "Phrase-employe-2026");
  await logout(page);

  await signIn(page, admin, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  await page.goto("/administration/comptes");
  const row = page.getByRole("row", { name: new RegExp(employee) });
  await row.getByRole("button", { name: "Désactiver" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmer" })
    .click();
  await expect(row).toContainText("Désactivé");

  const other = await (await browser.newContext()).newPage();
  await signIn(other, employee, "Phrase-employe-2026");
  await expect(other).toHaveURL(/\/login/);

  await row.getByRole("button", { name: "Réactiver" }).click();
  await expect(row).toContainText("Actif");
  await signIn(other, employee, "Phrase-employe-2026");
  await expect(other).toHaveURL(/\/tableau-de-bord/);
  await other.goto("/administration/comptes");
  await expect(other).toHaveURL(/\/tableau-de-bord/);
});
