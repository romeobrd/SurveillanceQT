import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("la page d'accueil s'affiche", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Vos locaux en 3D",
  );
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Connexion" }),
  ).toBeVisible();
});

test("connecté, la page d'accueil reste affichée et propose « Mon espace »", async ({
  page,
}) => {
  await login(page, "manager");
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Mon espace" })
    .click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  // Depuis le service, le logo ramène à l'accueil (pas de redirection automatique)
  await page.getByRole("link", { name: "Spacora — page d'accueil" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Vos locaux en 3D",
  );
  await expect(page).toHaveURL(/\/$/);
});
