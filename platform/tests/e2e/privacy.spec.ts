// Droits des personnes, présence, administration RGPD : sur l'entreprise de test dédiée, recréée avant chaque test.
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { DEV_PASSWORD, E2E_ACCOUNTS, login, logout } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  execSync("npm run db:seed:e2e", { stdio: "pipe" });
});

test("« Mes données » : consultation, export JSON et demande de droits", async ({
  page,
}) => {
  await login(page, "employee", E2E_ACCOUNTS);
  await page.getByRole("link", { name: "Mes données" }).click();
  await expect(
    page.getByRole("heading", { name: "Mes données" }),
  ).toBeVisible();
  await expect(page.getByText(E2E_ACCOUNTS.employee).first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Exporter mes données/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("mes-donnees.json");
  const path = await file.path();
  const exported = JSON.parse(
    (await import("node:fs")).readFileSync(path, "utf8"),
  );
  expect(exported.account.email).toBe(E2E_ACCOUNTS.employee);

  await page.getByLabel("Type de demande").selectOption("RECTIFICATION");
  await page.getByLabel(/Précisions/).fill("Mon intitulé est inexact.");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.getByRole("row", { name: /Rectification/ })).toContainText(
    "Ouverte",
  );

  // Un employé n'accède pas à l'administration
  await page.goto("/administration");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(
    0,
  );
});

test("présence facultative : activée par l'admin, déclarée par soi, totaux anonymes", async ({
  page,
}) => {
  await login(page, "employee", E2E_ACCOUNTS);
  await page.goto("/mes-donnees");
  await expect(page.getByText(/n'est pas activée/)).toBeVisible();
  await expect(page.getByTestId("presence-totals")).toHaveCount(0);
  await logout(page);

  await login(page, "admin", E2E_ACCOUNTS);
  await page.goto("/administration");
  await page.getByLabel(/Autoriser la déclaration de présence/).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("form-error")).toHaveCount(0);
  await logout(page);

  await login(page, "employee", E2E_ACCOUNTS);
  await page.goto("/mes-donnees");
  await page.getByRole("button", { name: "Je suis en télétravail" }).click();
  await expect(page.getByTestId("presence-current")).toContainText(
    "en télétravail",
  );
  await logout(page);

  await login(page, "manager", E2E_ACCOUNTS);
  const totals = page.getByTestId("presence-totals");
  await expect(totals).toContainText("1 En télétravail");
  await expect(totals).not.toContainText("Sophie"); // aucun nom, seulement des totaux
});

test("l'admin suit les demandes, exécute un effacement et consulte le journal", async ({
  page,
  browser,
}) => {
  const employee = await (await browser.newContext()).newPage();
  await login(employee, "employee", E2E_ACCOUNTS);
  await employee.goto("/mes-donnees");
  await employee.getByLabel("Type de demande").selectOption("ERASURE");
  await employee.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(employee.getByRole("row", { name: /Effacement/ })).toBeVisible();

  await login(page, "admin", E2E_ACCOUNTS);
  await page.goto("/administration/demandes");
  const row = page.getByRole("row", { name: /Effacement/ });
  await row.getByRole("button", { name: "Exécuter l'effacement" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmer" })
    .click();
  await expect(row).toContainText("Traitée");

  // Le compte anonymisé ne peut plus se connecter, même avec l'ancien mot de passe
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto("/login");
  await fresh
    .getByLabel("Adresse e-mail professionnelle")
    .fill(E2E_ACCOUNTS.employee);
  await fresh.getByLabel("Mot de passe").fill(DEV_PASSWORD);
  await fresh.getByRole("button", { name: "Se connecter" }).click();
  await expect(fresh).toHaveURL(/\/login/);

  await page.goto("/collaborateurs?status=ALL");
  await expect(page.getByText("Anonymisé").first()).toBeVisible();

  await page.goto("/administration/journal");
  await expect(
    page.getByRole("cell", { name: "person.anonymize" }).first(),
  ).toBeVisible();
  await page.goto("/administration/journal?action=privacy.request.create");
  await expect(
    page.getByRole("cell", { name: "privacy.request.create" }),
  ).toHaveCount(1);
});
