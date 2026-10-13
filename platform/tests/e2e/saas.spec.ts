// Parcours SaaS : site public, inscription en libre-service, essai, abonnement, lecture seule.
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { logout, uniqueId } from "./helpers";

async function signUp(page: Page, email: string) {
  await page.goto("/inscription");
  await page.getByLabel("Nom de l'entreprise").fill(`Agence ${uniqueId()}`);
  await page.getByLabel("Votre prénom").fill("Lina");
  await page.getByLabel("Votre nom").fill("Martin");
  await page.getByLabel("Votre e-mail professionnel").fill(email);
  await page.getByLabel(/Mot de passe/).fill("une-phrase-de-passe");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Démarrer l'essai gratuit" }).click();
}

test("le site public présente l'offre, les tarifs et les pages légales", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Vos locaux en 3D",
  );
  await expect(page.getByTestId("pricing-plan")).toHaveCount(3);
  await expect(page.locator("#tarifs")).toContainText("19");
  for (const [link, heading] of [
    ["Mentions légales", "Mentions légales"],
    ["CGU", "Conditions générales d'utilisation"],
    ["CGV", "Conditions générales de vente"],
    ["Confidentialité", "Politique de confidentialité"],
  ]) {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: link, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    await expect(page.getByRole("note")).toContainText("MODÈLE");
  }
  await page.goto("/");
  await page
    .getByRole("link", { name: "Essai gratuit 14 jours" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/inscription/);
});

test("une entreprise s'inscrit seule et démarre son essai sur la carte vide", async ({
  page,
}) => {
  const email = `lina.${uniqueId()}@horizon.example`;
  await signUp(page, email);
  await expect(page).toHaveURL(/\/carte/);
  await expect(page.getByTestId("billing-banner")).toContainText("14 jour(s)");
  await expect(page.getByRole("button", { name: /Générer/ })).toBeVisible();

  await page.goto("/administration/abonnement");
  const status = page.getByTestId("billing-status");
  await expect(status).toContainText("Essai gratuit");
  await expect(status).toContainText("1 / 50 collaborateurs");
  await expect(page.getByRole("heading", { name: "Business" })).toBeVisible();

  // Un deuxième essai avec le même e-mail est refusé
  await logout(page);
  await signUp(page, email);
  await expect(page.getByTestId("signup-error")).toContainText(
    "déjà un compte",
  );
});

test("l'inscription exige les CGU", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Nom de l'entreprise").fill("Agence sans CGU");
  await page.getByLabel("Votre prénom").fill("Lina");
  await page.getByLabel("Votre nom").fill("Martin");
  await page
    .getByLabel("Votre e-mail professionnel")
    .fill(`sans.cgu.${uniqueId()}@horizon.example`);
  await page.getByLabel(/Mot de passe/).fill("une-phrase-de-passe");
  await page.getByRole("button", { name: "Démarrer l'essai gratuit" }).click();
  await expect(page.getByTestId("signup-error")).toContainText(
    "conditions générales",
  );
});

test("à la fin de l'essai, l'espace passe en lecture seule (consultation et export restent possibles)", async ({
  page,
}) => {
  const email = `fin.essai.${uniqueId()}@horizon.example`;
  await signUp(page, email);
  await expect(page).toHaveURL(/\/carte/);
  execSync(`npm run e2e:tools -- expire-trial ${email}`, { stdio: "pipe" });

  await page.goto("/collaborateurs/nouveau");
  await page.getByLabel("Prénom").fill("Paul");
  await page.getByLabel("Nom", { exact: true }).fill("Bloqué");
  await page
    .getByLabel("E-mail professionnel")
    .fill(`paul.${uniqueId()}@horizon.example`);
  await page.getByLabel("Intitulé de poste").fill("Comptable");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByTestId("form-error")).toContainText(
    "plus modifiables",
  );
  await expect(page.getByTestId("billing-banner")).toContainText(
    "Lecture seule",
  );

  // Les données restent consultables et exportables (droits RGPD)
  await page.goto("/mes-donnees");
  await expect(
    page.getByRole("link", { name: /Exporter mes données/ }),
  ).toBeVisible();
  await page.goto("/administration/abonnement");
  await expect(page.getByTestId("billing-status")).toContainText(
    "ne sont plus modifiables",
  );
});
