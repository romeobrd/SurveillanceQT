import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function openMap(page: Page, seed: number) {
  if (!page.url().includes("/carte")) await login(page, "manager");
  await page.goto(`/carte?seed=${seed}`);
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
}

test("la navigation mène à la carte", async ({ page }) => {
  await login(page, "manager");
  await page.getByRole("link", { name: "Carte", exact: true }).click();
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
  const first = page.getByRole("complementary").getByRole("button").first();
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

test("les indicateurs de l'entreprise sont posés sur la carte et mènent aux modules", async ({
  page,
}) => {
  await login(page, "manager");
  await page.goto("/carte");
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
  const kpis = page.getByTestId("map-kpis");
  await expect(kpis).toContainText("Collaborateurs");
  await expect(kpis).toContainText("Alertes de stock");
  await kpis.getByRole("link", { name: /Alertes de stock/ }).click();
  await expect(page).toHaveURL(/\/stock\?alert=low/);
});

test("une épingle signale une pièce à traiter et ouvre son panneau avec le stock à réapprovisionner", async ({
  page,
}) => {
  await login(page, "manager");
  await page.goto("/carte");
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
  const pin = page.getByTestId("zone-pin").last();
  await expect(pin).toBeVisible();
  await expect(pin).toHaveAccessibleName(/alerte/);
  const zoneName = ((await pin.getAttribute("aria-label")) ?? "").split(
    " :",
  )[0];
  await pin.click();
  const panel = page.getByRole("complementary");
  await expect(
    panel.getByRole("heading", { name: zoneName, level: 2 }),
  ).toBeVisible();
  await expect(panel).toContainText(/Sous le seuil|Hors service|En panne/);
  await panel.getByRole("button", { name: "Fermer le panneau" }).click();
  await expect(
    page.getByRole("heading", { name: "Zones", level: 2 }),
  ).toBeVisible();
});

test("la vue tourne avec les boutons et le clavier, et le recentrage la rétablit", async ({
  page,
}) => {
  await openMap(page, 5);
  const before = await page.evaluate(() => window.__mapDebug!.tileCenter(0, 0));
  await page
    .getByRole("button", { name: "Tourner la vue vers la droite" })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__mapDebug!.tileCenter(0, 0)))
    .not.toEqual(before);
  await page.getByTestId("map-host").focus();
  await page.keyboard.press("q");
  await page.getByRole("button", { name: "Recentrer la vue" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mapDebug!.tileCenter(0, 0)))
    .toEqual(before);
});

test("survoler un objet affiche son info-bulle ; un poste montre son occupant ou « Poste libre »", async ({
  page,
}) => {
  await login(page, "manager");
  await page.goto("/carte");
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
  const box = (await page.getByTestId("map-host").boundingBox())!;
  const ids = await page.evaluate(() =>
    window.__mapDebug!.elementIds("bureau_double"),
  );
  const tooltip = page.getByTestId("element-tooltip");
  // Le premier bureau dont le dessus est visible (non masqué par un mur ou le panneau) suffit
  let text = "";
  for (const id of ids) {
    const point = await page.evaluate(
      (elementId) => window.__mapDebug!.elementPoint(elementId),
      id,
    );
    if (!point || point.x < 0 || point.x > box.width - 420) continue;
    await page.mouse.move(box.x + point.x, box.y + point.y);
    if (await tooltip.isVisible().catch(() => false)) {
      text = await tooltip.innerText();
      break;
    }
  }
  expect(text).toMatch(/Poste libre|·/);
});

test("choisir une pièce fait voler la caméra jusqu'à elle", async ({
  page,
}) => {
  await login(page, "manager");
  await page.goto("/carte");
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
  const before = await page.evaluate(() => window.__mapDebug!.stats().zoom);
  await page.getByTestId("zone-pin").first().click();
  await expect
    .poll(() => page.evaluate(() => window.__mapDebug!.stats().zoom))
    .toBeGreaterThan(before * 1.2);
});
