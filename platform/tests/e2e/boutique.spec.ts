// Site + espace client (édition boutique) : compte client, offre, paiement (simulé en démonstration),
// téléchargement de l'application de bureau. L'application elle-même n'est pas servie sur le site.
import { expect, test, type Page } from "@playwright/test";
import { uniqueId } from "./helpers";

async function createClientAccount(page: Page, email: string) {
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Créer mon compte" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Créer votre compte client" }),
  ).toBeVisible();
  await page.getByLabel("Nom de l'entreprise").fill(`Cabinet ${uniqueId()}`);
  await page.getByLabel("Votre prénom").fill("Lina");
  await page.getByLabel("Votre nom").fill("Martin");
  await page.getByLabel("Votre e-mail professionnel").fill(email);
  await page.getByLabel(/Mot de passe/).fill("une-phrase-de-passe");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/espace-client/);
}

test("un client crée son compte, paie son offre et télécharge l'application", async ({
  page,
}) => {
  const email = `client.${uniqueId()}@boutique.example`;
  await createClientAccount(page, email);

  // Avant paiement : offres proposées, téléchargement verrouillé
  await expect(page.getByTestId("client-subscription")).toContainText(
    "Aucun abonnement",
  );
  await expect(
    page.getByText("Le téléchargement est disponible dès que"),
  ).toBeVisible();
  const locked = await page.request.get("/espace-client/telecharger", {
    maxRedirects: 0,
  });
  expect(locked.headers().location).toMatch(/\/espace-client$/);

  // Paiement simulé de l'offre Pro (démonstration sans Stripe)
  await page
    .getByTestId("offer-pro")
    .getByRole("button", { name: /Choisir Pro/ })
    .click();
  await expect(page.getByText("Votre abonnement est actif")).toBeVisible();
  await expect(page.getByTestId("client-subscription")).toContainText(
    "Abonnement Pro actif",
  );

  // Téléchargement : redirection vers l'installateur Windows
  await expect(
    page.getByRole("link", { name: "Télécharger Spacora (.exe)" }),
  ).toBeVisible();
  const download = await page.request.get("/espace-client/telecharger", {
    maxRedirects: 0,
  });
  expect(download.status()).toBe(307);
  expect(download.headers().location).toContain("Spacora-Setup.exe");

  // L'application n'est pas servie sur le site : retour à l'espace client
  await page.goto("/tableau-de-bord");
  await expect(page).toHaveURL(/\/espace-client/);
  await page.goto("/carte");
  await expect(page).toHaveURL(/\/espace-client/);

  // Reconnexion : arrivée directe dans l'espace client
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill("une-phrase-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/espace-client/);
});

test("le site présente l'achat puis le téléchargement, sans essai gratuit", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("puis téléchargez Spacora pour Windows").first(),
  ).toBeVisible();
  await expect(page.getByText("Essai gratuit 14 jours")).toHaveCount(0);
});
