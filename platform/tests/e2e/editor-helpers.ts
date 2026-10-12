import { expect, type Page } from "@playwright/test";
import { login } from "./helpers";

export async function openEditor(
  page: Page,
  who: "manager" | "admin" = "manager",
) {
  await login(page, who);
  await page.goto("/carte");
  await waitForMap(page);
  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await expect(page.getByTestId("layout-editor")).toBeVisible();
}

export async function waitForMap(page: Page) {
  await page.waitForFunction(() => window.__mapDebug !== undefined, null, {
    timeout: 30_000,
  });
}

/** Repart de locaux vides (24×20 par défaut) : positions des tuiles connues et déterministes. */
export async function startEmpty(page: Page, width = 24, height = 20) {
  await page.getByRole("tab", { name: "Point de départ" }).click();
  await page.getByLabel("Largeur").fill(String(width));
  await page.getByLabel("Hauteur").fill(String(height));
  await page.getByRole("button", { name: "Créer" }).click();
  await page.getByRole("tab", { name: "Éléments" }).click();
  await page.getByRole("button", { name: "Recentrer la vue" }).click();
}

/** Position d'écran (page entière) du centre d'une tuile, ou d'un point fractionnaire de la grille. */
export async function gridPoint(page: Page, gx: number, gy: number) {
  const box = (await page.getByTestId("map-host").boundingBox())!;
  const point = await page.evaluate(
    ([x, y]) => window.__mapDebug!.gridPoint(x, y),
    [gx, gy],
  );
  return { x: box.x + point.x, y: box.y + point.y };
}

export const tilePoint = (page: Page, x: number, y: number) =>
  gridPoint(page, x + 0.5, y + 0.5);

export async function clickTile(
  page: Page,
  x: number,
  y: number,
  options?: { shift?: boolean },
) {
  const point = await tilePoint(page, x, y);
  if (options?.shift) await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y);
  if (options?.shift) await page.keyboard.up("Shift");
}

export async function dragTile(
  page: Page,
  from: [number, number],
  to: [number, number],
  options?: { shift?: boolean },
) {
  const a = await tilePoint(page, from[0], from[1]);
  const b = await tilePoint(page, to[0], to[1]);
  if (options?.shift) await page.keyboard.down("Shift");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  if (options?.shift) await page.keyboard.up("Shift");
}

export const itemCount = (page: Page) =>
  page.evaluate(() => window.__mapDebug!.stats().totalItems);

export const feedback = (page: Page) => page.getByTestId("editor-feedback");

export const armCatalogItem = (page: Page, name: RegExp | string) =>
  page
    .getByRole("button", { name, exact: typeof name === "string" })
    .first()
    .click();

export const toolbar = (page: Page) =>
  page.getByRole("group", { name: "Aménagement des locaux" });
