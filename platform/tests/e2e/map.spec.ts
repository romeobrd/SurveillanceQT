import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function openMap(page: Page, seed: number) {
  if (!page.url().includes("/carte")) await login(page, "manager");
  await page.goto(`/carte?seed=${seed}`);
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
}

test("la page d'accueil mène à la carte une fois connecté", async ({
  page,
}) => {
  await login(page, "manager");
  await page.goto("/");
  await page.getByRole("link", { name: "Ouvrir la carte des locaux" }).click();
  await expect(page).toHaveURL(/\/carte/);
  await expect(
    page.getByRole("heading", { name: "Carte des locaux" }),
  ).toBeVisible();
});

test("la carte s'affiche avec des objets dessinés", async ({ page }) => {
  await openMap(page, 5);
  const stats = await page.evaluate(() => window.__mapDebug!.stats());
  expect(stats.totalItems).toBeGreaterThan(100);
  expect(stats.visibleItems).toBeGreaterThan(0);
});

test("un clic sur une zone de la carte ouvre le panneau latéral, la croix le referme", async ({
  page,
}) => {
  await openMap(page, 5);
  const center = await page.evaluate(() => window.__mapDebug!.zoneCenter("z2"));
  const box = await page.getByTestId("map-host").boundingBox();
  expect(center && box).toBeTruthy();
  await page.mouse.click(box!.x + center!.x, box!.y + center!.y);
  await expect(
    page.getByRole("heading", { name: "Postes de travail", level: 3 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fermer le panneau" }).click();
  await expect(
    page.getByRole("heading", { name: "Zones", level: 2 }),
  ).toBeVisible();
});

test("la liste des zones permet de choisir une zone au clavier", async ({
  page,
}) => {
  await openMap(page, 5);
  const first = page.getByRole("list").first().getByRole("button").first();
  const name = (await first.innerText()).trim();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
});

test("le seed de l'URL reproduit la même carte", async ({ page }) => {
  await openMap(page, 77);
  const first = await page.evaluate(
    () => window.__mapDebug!.stats().totalItems,
  );
  await openMap(page, 77);
  const second = await page.evaluate(
    () => window.__mapDebug!.stats().totalItems,
  );
  expect(second).toBe(first);
  await expect(page.getByTestId("seed")).toHaveText("77");
});

test("le bouton génère de nouveaux locaux avec un nouveau seed", async ({
  page,
}) => {
  await openMap(page, 77);
  await page
    .getByRole("button", { name: "Générer de nouveaux locaux" })
    .click();
  await expect(page).toHaveURL(/seed=\d+/);
  await expect(page.getByTestId("seed")).not.toHaveText("77");
});

test("le clavier zoome la carte", async ({ page }) => {
  await openMap(page, 5);
  const before = await page.evaluate(() => window.__mapDebug!.stats().zoom);
  await page.getByTestId("map-host").focus();
  await page.keyboard.press("+");
  await expect
    .poll(() => page.evaluate(() => window.__mapDebug!.stats().zoom))
    .toBeGreaterThan(before);
});

test("la molette zoome la carte", async ({ page }) => {
  await openMap(page, 5);
  const before = await page.evaluate(() => window.__mapDebug!.stats().zoom);
  const box = await page.getByTestId("map-host").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -400);
  await expect
    .poll(() => page.evaluate(() => window.__mapDebug!.stats().zoom))
    .toBeGreaterThan(before);
});

test("le glisser déplace la carte sans sélectionner de zone", async ({
  page,
}) => {
  await openMap(page, 5);
  const box = (await page.getByTestId("map-host").boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByRole("heading", { name: "Zones", level: 2 }),
  ).toBeVisible();
});
