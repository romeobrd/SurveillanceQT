// Enregistrement, réaffectation et restauration : sur l'entreprise de test dédiée, recréée avant chaque test.
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { checkPlacement } from "../../lib/map/edit";
import { generateLayout } from "../../lib/map/generator";
import { E2E_ACCOUNTS, login } from "./helpers";
import {
  armCatalogItem,
  clickTile,
  feedback,
  waitForMap,
} from "./editor-helpers";

test.describe.configure({ mode: "serial" });

const layout = generateLayout(2024);

test.beforeEach(() => {
  execSync("npm run db:seed:e2e", { stdio: "pipe" });
});

async function loginE2e(
  page: Page,
  who: keyof typeof E2E_ACCOUNTS = "manager",
) {
  await login(page, who, E2E_ACCOUNTS);
}

async function openE2eEditor(page: Page) {
  await loginE2e(page);
  await page.goto("/carte");
  await waitForMap(page);
  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await expect(page.getByTestId("layout-editor")).toBeVisible();
}

/** Première position libre pour un bureau simple dans la carte de départ (calculée avec le même moteur). */
function freeDeskSpot(): [number, number] {
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (
        checkPlacement(layout, {
          catalogKey: "bureau_simple",
          x,
          y,
          rotation: 0,
        }) === null
      )
        return [x, y];
    }
  }
  throw new Error("aucun emplacement libre");
}

async function addDeskAndSave(page: Page) {
  const [x, y] = freeDeskSpot();
  await armCatalogItem(page, /Bureau simple/);
  // Le bureau 2×1 est centré sur le pointeur : on vise la tuile d'ancrage
  await clickTile(page, x, y);
  await expect(feedback(page)).toContainText("Élément posé");
  await page.getByRole("button", { name: "Enregistrer l'aménagement" }).click();
}

test("enregistre une nouvelle version sans réaffectation quand rien d'utilisé n'est supprimé", async ({
  page,
}) => {
  await openE2eEditor(page);
  await addDeskAndSave(page);
  await expect(page.getByTestId("layout-editor")).toHaveCount(0);
  await expect(page.getByText("Version 2")).toBeVisible();
  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await page.getByRole("tab", { name: "Versions" }).click();
  await expect(page.getByTestId("version")).toHaveCount(2);
});

test("exige une décision pour un poste attribué supprimé, puis libère la personne", async ({
  page,
}) => {
  await loginE2e(page);
  await page.goto("/postes?status=occupied");
  const label = await page
    .locator("tbody tr")
    .first()
    .locator("td")
    .first()
    .innerText();
  const personName = (
    await page.locator("tbody tr").first().locator("td").nth(2).innerText()
  ).trim();
  const key = /\((e[^)]*)\)/.exec(label)![1];
  const element = layout.elements.find((candidate) => candidate.id === key)!;

  await page.goto("/carte");
  await waitForMap(page);
  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await clickTile(page, element.x, element.y);
  await page.keyboard.press("Delete");
  await expect(feedback(page)).toContainText("supprimé");
  await page.getByRole("button", { name: "Enregistrer l'aménagement" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Réaffecter avant d'enregistrer");
  await expect(dialog).toContainText(personName);
  const confirm = dialog.getByRole("button", {
    name: "Enregistrer avec ces décisions",
  });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("combobox").selectOption("release");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByTestId("layout-editor")).toHaveCount(0);

  await page.goto(
    `/postes?search=${encodeURIComponent(personName.split(" ")[1])}`,
  );
  await expect(page.getByText("Aucun résultat.")).toBeVisible();
  await page.goto("/collaborateurs?status=ACTIVE");
  await expect(page.getByText(personName.split(" ")[1]).first()).toBeVisible(); // la personne reste dans l'entreprise
});

test("déplace la personne sur un autre poste libre", async ({ page }) => {
  await loginE2e(page);
  await page.goto("/postes?status=occupied");
  const row = page.locator("tbody tr").first();
  const key = /\((e[^)]*)\)/.exec(
    await row.locator("td").first().innerText(),
  )![1];
  const personName = (await row.locator("td").nth(2).innerText()).trim();
  const element = layout.elements.find((candidate) => candidate.id === key)!;

  await page.goto("/carte");
  await waitForMap(page);
  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await clickTile(page, element.x, element.y);
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Enregistrer l'aménagement" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Réaffecter avant d'enregistrer");
  const select = dialog.getByRole("combobox");
  const options = await select.locator("option").allInnerTexts();
  const target = options.find((text) => text.startsWith("Placer sur"))!;
  await select.selectOption({ label: target });
  await dialog
    .getByRole("button", { name: "Enregistrer avec ces décisions" })
    .click();
  await expect(page.getByTestId("layout-editor")).toHaveCount(0);

  await page.goto(
    `/postes?search=${encodeURIComponent(personName.split(" ")[1])}`,
  );
  await expect(
    page.getByRole("row", { name: new RegExp(personName.split(" ")[1]) }),
  ).toBeVisible();
});

test("range le stock d'une pièce supprimée sans rien perdre", async ({
  page,
}) => {
  const reserve = layout.zones.find((zone) => zone.type === "reserve")!;
  await openE2eEditor(page);
  await page.getByRole("tab", { name: "Pièces" }).click();
  await page
    .getByRole("button", { name: new RegExp(reserve.name) })
    .first()
    .click();
  await page.getByRole("button", { name: "Supprimer la pièce" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmer" })
    .click();
  await page.getByRole("button", { name: "Enregistrer l'aménagement" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(reserve.name);
  await expect(dialog).toContainText("article(s) de stock");
  await dialog.getByRole("combobox").first().selectOption("unassign");
  await dialog
    .getByRole("button", { name: "Enregistrer avec ces décisions" })
    .click();
  await expect(page.getByTestId("layout-editor")).toHaveCount(0);

  await page.goto("/stock?search=PAP-A4");
  await expect(
    page.getByRole("row", { name: /Ramettes de papier A4/ }),
  ).toContainText("Sans zone");
});

test("restaure une ancienne version en créant une nouvelle version", async ({
  page,
}) => {
  await openE2eEditor(page);
  await addDeskAndSave(page);
  await expect(page.getByText("Version 2")).toBeVisible();

  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await page.getByRole("tab", { name: "Versions" }).click();
  await page.getByRole("button", { name: "Restaurer Version 1" }).click();
  await expect(page.getByTestId("layout-editor")).toHaveCount(0);
  await expect(page.getByText("Version 3")).toBeVisible();

  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await page.getByRole("tab", { name: "Versions" }).click();
  await expect(page.getByTestId("version")).toHaveCount(3); // rien n'est effacé de l'historique
});

test("refuse d'écraser une carte modifiée entre-temps", async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  await openE2eEditor(first);
  await openE2eEditor(second);

  await addDeskAndSave(first); // la première session enregistre la version 2
  await expect(first.getByText("Version 2")).toBeVisible();

  // La seconde session part encore de la version 1 : son enregistrement doit être refusé
  const [x, y] = freeDeskSpot();
  await armCatalogItem(second, /Bureau simple/);
  await clickTile(second, x, y);
  await expect(feedback(second)).toContainText("Élément posé");
  await second
    .getByRole("button", { name: "Enregistrer l'aménagement" })
    .click();
  await expect(second.getByTestId("save-problems")).toContainText(
    "modifiée par quelqu'un d'autre",
  );
  await expect(second.getByTestId("layout-editor")).toBeVisible(); // le travail en cours n'est pas perdu
});
