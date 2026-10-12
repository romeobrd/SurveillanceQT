// Mode Aménager : gestes sur la carte (poser, déplacer, tourner, supprimer, pièces, murs), sans rien enregistrer.
import { expect, test } from "@playwright/test";
import { login } from "./helpers";
import {
  armCatalogItem,
  clickTile,
  dragTile,
  feedback,
  gridPoint,
  itemCount,
  openEditor,
  startEmpty,
  tilePoint,
  toolbar,
  waitForMap,
} from "./editor-helpers";

test("le mode Aménager est réservé aux administrateurs et aux managers", async ({
  page,
}) => {
  await login(page, "employee");
  await page.goto("/carte");
  await expect(
    page.getByRole("heading", { name: "Carte des locaux" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aménager", exact: true }),
  ).toHaveCount(0);
  await page.goto("/carte?seed=7");
  await expect(
    page.getByRole("button", { name: "Aménager", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("preview-badge")).toHaveCount(0);
});

test("la bascule Vue / Aménager affiche l'éditeur avec son catalogue", async ({
  page,
}) => {
  await openEditor(page, "admin");
  await expect(page.getByTestId("dirty-state")).toHaveText(
    "Aucune modification",
  );
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  for (const category of [
    "Postes de travail",
    "Mobilier",
    "Équipements",
    "Structure",
  ]) {
    await expect(
      page.getByRole("heading", { name: category, level: 3 }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Vue", exact: true }).click();
  await expect(page.getByTestId("layout-editor")).toHaveCount(0);
});

test.describe("poser des éléments sur des locaux vides", () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page);
    await startEmpty(page);
  });

  test("pose au clic, annule, rétablit, et signale les modifications non enregistrées", async ({
    page,
  }) => {
    const before = await itemCount(page);
    await armCatalogItem(page, /Bureau simple/);
    await clickTile(page, 5, 5);
    await expect(feedback(page)).toContainText("Élément posé");
    expect(await itemCount(page)).toBe(before + 1);
    await expect(page.getByTestId("dirty-state")).toHaveText(
      "Modifications non enregistrées",
    );

    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(feedback(page)).toContainText("Action annulée");
    expect(await itemCount(page)).toBe(before);
    await page.getByRole("button", { name: "Rétablir", exact: true }).click();
    await expect(feedback(page)).toContainText("Action rétablie");
    expect(await itemCount(page)).toBe(before + 1);
  });

  test("Ctrl+Z et Ctrl+Y annulent et rétablissent", async ({ page }) => {
    const before = await itemCount(page);
    await armCatalogItem(page, /Plante/);
    await clickTile(page, 6, 6);
    expect(await itemCount(page)).toBe(before + 1);
    await page.keyboard.press("Control+z");
    await expect.poll(() => itemCount(page)).toBe(before);
    await page.keyboard.press("Control+y");
    await expect.poll(() => itemCount(page)).toBe(before + 1);
  });

  test("montre un fantôme rouge et refuse une collision", async ({ page }) => {
    await armCatalogItem(page, /Bureau simple/);
    await clickTile(page, 5, 5);
    const placed = await itemCount(page);
    const point = await tilePoint(page, 5, 5);
    await page.mouse.move(point.x - 20, point.y);
    await page.mouse.move(point.x, point.y);
    await expect(page.getByTestId("ghost-problem")).toContainText("collision");
    await page.mouse.click(point.x, point.y);
    await expect(feedback(page)).toContainText("Placement refusé");
    expect(await itemCount(page)).toBe(placed);
  });

  test("garde le passage de la porte libre", async ({ page }) => {
    await armCatalogItem(page, /Plante/);
    const entrance = await tilePoint(page, 12, 19); // tuile derrière la porte d'entrée
    await page.mouse.move(entrance.x - 15, entrance.y);
    await page.mouse.move(entrance.x, entrance.y);
    await expect(page.getByTestId("ghost-problem")).toContainText("porte");
    await page.mouse.click(entrance.x, entrance.y);
    await expect(feedback(page)).toContainText("Placement refusé");
  });

  test("pose par glisser-déposer depuis le catalogue", async ({ page }) => {
    const before = await itemCount(page);
    const target = await tilePoint(page, 8, 8);
    const box = (await page.getByTestId("map-host").boundingBox())!;
    await page
      .getByRole("button", { name: /Étagère/ })
      .dragTo(page.getByTestId("map-host"), {
        targetPosition: { x: target.x - box.x, y: target.y - box.y },
      });
    await expect(feedback(page)).toContainText("Élément posé");
    expect(await itemCount(page)).toBe(before + 1);
  });

  test("pose au clavier : flèches puis Entrée", async ({ page }) => {
    const before = await itemCount(page);
    await armCatalogItem(page, /Plante/);
    await page.getByTestId("map-host").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(feedback(page)).toContainText("Élément posé");
    expect(await itemCount(page)).toBe(before + 1);
  });

  test("déplace en glissant, refuse de superposer, tourne avec R et supprime avec Suppr", async ({
    page,
  }) => {
    await armCatalogItem(page, /Plante/);
    await clickTile(page, 4, 4);
    await clickTile(page, 10, 4);
    await toolbar(page).getByRole("button", { name: "Sélection" }).click();

    await dragTile(page, [4, 4], [4, 9]);
    await expect(feedback(page)).toContainText("Élément déplacé");
    await dragTile(page, [4, 9], [10, 4]); // sur l'autre plante
    await expect(feedback(page)).toContainText("Placement refusé");

    await armCatalogItem(page, /Bureau simple/);
    await clickTile(page, 15, 10);
    await toolbar(page).getByRole("button", { name: "Sélection" }).click();
    await clickTile(page, 15, 10);
    await page.keyboard.press("r");
    await expect(feedback(page)).toContainText("Élément tourné");

    const before = await itemCount(page);
    await page.keyboard.press("Delete");
    await expect(feedback(page)).toContainText("supprimé");
    expect(await itemCount(page)).toBe(before - 1);
  });

  test("sélection multiple au rectangle puis suppression du groupe", async ({
    page,
  }) => {
    await armCatalogItem(page, /Plante/);
    for (const [x, y] of [
      [3, 3],
      [5, 3],
      [7, 3],
    ]) {
      await clickTile(page, x, y);
    }
    await toolbar(page).getByRole("button", { name: "Sélection" }).click();
    await dragTile(page, [2, 2], [8, 4], { shift: true });
    await expect(page.getByText("3 élément(s) sélectionné(s)")).toBeVisible();
    const before = await itemCount(page);
    await page.getByRole("button", { name: "Supprimer la sélection" }).click();
    await expect(feedback(page)).toContainText("3 élément(s) supprimé(s)");
    expect(await itemCount(page)).toBe(before - 3);
  });

  test("trace une pièce dans l'espace libre et refuse un chevauchement", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Pièces" }).click();
    await page.getByRole("button", { name: /Open space 1/ }).click();
    const resize = page.getByRole("group", { name: /Position et taille/ });
    await resize.getByLabel("Largeur").fill("12");
    await resize
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Appliquer" })
      .click();

    await toolbar(page)
      .getByRole("button", { name: "Tracer une pièce" })
      .click();
    await dragTile(page, [14, 3], [20, 9]);
    await expect(feedback(page)).toContainText("Pièce créée");
    await expect(
      page.getByRole("button", { name: /Bureau individuel 1/ }),
    ).toBeVisible();

    await toolbar(page)
      .getByRole("button", { name: "Tracer une pièce" })
      .click();
    await dragTile(page, [2, 2], [6, 6]); // sur la première pièce
    await expect(feedback(page)).toContainText("Pièce refusée");
  });

  test("pose une cloison vitrée, une porte, puis efface l'arête", async ({
    page,
  }) => {
    const edge = await gridPoint(page, 8.5, 6.02);
    for (const tool of ["Cloison vitrée", "Porte", "Gomme"]) {
      await toolbar(page).getByRole("button", { name: tool }).click();
      await page.mouse.move(edge.x - 10, edge.y);
      await page.mouse.click(edge.x, edge.y);
      await expect(feedback(page)).toContainText("Arête modifiée");
    }
  });

  test("refuse l'enregistrement d'une carte sans porte d'entrée, sans rien envoyer au serveur", async ({
    page,
  }) => {
    await toolbar(page).getByRole("button", { name: "Gomme" }).click();
    const entrance = await gridPoint(page, 12.5, 20.02);
    await page.mouse.move(entrance.x - 10, entrance.y);
    await page.mouse.click(entrance.x, entrance.y);
    await expect(feedback(page)).toContainText("Arête modifiée");
    await page
      .getByRole("button", { name: "Enregistrer l'aménagement" })
      .click();
    await expect(page.getByTestId("save-problems")).toContainText(
      "porte d'entrée",
    );
  });

  test("propose de repartir de la carte enregistrée, d'une carte générée ou de locaux vides", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Point de départ" }).click();
    await page.getByLabel("Seed", { exact: true }).fill("5");
    await page.getByRole("button", { name: "Générer" }).click();
    await expect(page.getByTestId("dirty-state")).toHaveText(
      "Modifications non enregistrées",
    );
    await page
      .getByRole("button", { name: "Carte enregistrée" })
      .last()
      .click();
    await expect(page.getByTestId("dirty-state")).toHaveText(
      "Aucune modification",
    );
  });

  test("demande confirmation avant de quitter avec des modifications non enregistrées", async ({
    page,
  }) => {
    await armCatalogItem(page, /Plante/);
    await clickTile(page, 6, 6);
    await page.getByRole("button", { name: "Vue", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Quitter sans enregistrer ?",
    );
    await page.getByRole("button", { name: "Rester" }).click();
    await expect(page.getByTestId("layout-editor")).toBeVisible();
    await page.getByRole("button", { name: "Vue", exact: true }).click();
    await page.getByRole("button", { name: "Quitter", exact: true }).click();
    await expect(page.getByTestId("layout-editor")).toHaveCount(0);
  });
});

test("les versions enregistrées sont listées dans l'éditeur", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Versions" }).click();
  await expect(page.getByTestId("version").first()).toContainText("Version");
  await expect(page.getByTestId("version").first()).toContainText("Active");
  await waitForMap(page);
});
