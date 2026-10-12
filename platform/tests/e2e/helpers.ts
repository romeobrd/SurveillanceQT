import { expect, type Page } from "@playwright/test";

// Comptes du seed de développement (données 100 % fictives, voir README)
export const DEV_PASSWORD = "Demo-Password-2026!";
export const ACCOUNTS = {
  admin: "admin@atelier-lumiere.example",
  manager: "manager@atelier-lumiere.example",
  employee: "employee@atelier-lumiere.example",
} as const;

export async function login(
  page: Page,
  who: keyof typeof ACCOUNTS = "manager",
) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail professionnelle").fill(ACCOUNTS[who]);
  await page.getByLabel("Mot de passe").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/carte/);
}
