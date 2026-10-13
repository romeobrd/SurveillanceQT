import { expect, test, type Page } from "@playwright/test";
import { login, logout, uniqueId } from "./helpers";

async function createStockItem(
  page: Page,
  reference: string,
  name: string,
  threshold = 10,
) {
  await page.goto("/stock/nouveau");
  await page.getByLabel("Article", { exact: true }).fill(name);
  await page.getByLabel("Référence").fill(reference);
  await page.getByLabel("Seuil d'alerte").fill(String(threshold));
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function addMovement(
  page: Page,
  type: string,
  quantity: number,
  reason: string,
) {
  await page.getByLabel("Type").selectOption(type);
  await page.getByLabel("Quantité", { exact: false }).fill(String(quantity));
  await page.getByLabel("Motif").fill(reason);
  await page.getByRole("button", { name: "Enregistrer le mouvement" }).click();
}

test("le tableau de bord résume l'entreprise et renvoie vers la carte", async ({
  page,
}) => {
  await login(page, "manager");
  for (const label of [
    "Collaborateurs actifs",
    "Postes occupés",
    "Postes disponibles",
    "Alertes de stock",
    "Matériel en panne",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Avancement des projets" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Afficher sur la carte" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/carte\?project=/);
  await expect(page.getByTestId("project-bar")).toBeVisible();
  await expect(page.getByTestId("project-progress")).toContainText("%");
});

test.describe("collaborateurs", () => {
  test("l'admin crée, retrouve, modifie puis marque un collaborateur comme parti", async ({
    page,
  }) => {
    const id = uniqueId();
    await login(page, "admin");
    await page.goto("/collaborateurs/nouveau");
    await page.getByLabel("Prénom").fill("Alice");
    await page.getByLabel("Nom", { exact: true }).fill(`Test${id}`);
    await page
      .getByLabel("E-mail professionnel")
      .fill(`alice.${id}@atelier-lumiere.example`);
    await page.getByLabel("Intitulé de poste").fill("Comptable");
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page).toHaveURL(/\/collaborateurs$/);

    await page.goto(`/collaborateurs?search=Test${id}`);
    const row = page.getByRole("row", { name: new RegExp(`Test${id}`) });
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "Modifier" }).click();
    await page.getByLabel("Intitulé de poste").fill("Directrice financière");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page).toHaveURL(/\/collaborateurs$/);
    await page.goto(`/collaborateurs?search=Test${id}`);
    await expect(
      page.getByRole("row", { name: /Directrice financière/ }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Modifier" }).click();
    await page.getByRole("button", { name: "Marquer comme parti" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmer" })
      .click();
    await expect(page).toHaveURL(/\/collaborateurs$/);
    await page.goto(`/collaborateurs?search=Test${id}`);
    await expect(page.getByText("Aucun résultat.")).toBeVisible();
    await page.goto(`/collaborateurs?search=Test${id}&status=DEPARTED`);
    await expect(
      page.getByRole("row", { name: new RegExp(`Test${id}`) }),
    ).toBeVisible();
  });

  test("la recherche et le tri passent par l'URL", async ({ page }) => {
    await login(page, "manager");
    await page.goto("/collaborateurs?search=bernard");
    await expect(page.getByRole("row", { name: /Bernard/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Durand/ })).toHaveCount(0);
    await page.goto("/collaborateurs?sort=lastName&dir=desc");
    const names = await page.locator("tbody tr td:first-child").allInnerTexts();
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a, "fr")));
  });

  test("le manager ne peut pas créer de collaborateur ; l'employé ne voit pas les e-mails", async ({
    page,
  }) => {
    await login(page, "manager");
    await expect(
      page.getByRole("link", { name: "Nouveau collaborateur" }),
    ).toHaveCount(0);
    await page.goto("/collaborateurs/nouveau");
    await expect(page).toHaveURL(/\/collaborateurs$/);
    await logout(page);

    await login(page, "employee");
    await page.goto("/collaborateurs");
    await expect(
      page.getByRole("columnheader", { name: "E-mail professionnel" }),
    ).toHaveCount(0);
    await expect(page.getByText("@atelier-lumiere.example")).toHaveCount(0);
  });

  test("l'admin gère les équipes : création, renommage, suppression", async ({
    page,
  }) => {
    const name = `Equipe${uniqueId()}`;
    await login(page, "admin");
    await page.goto("/collaborateurs/equipes");
    await page.getByLabel("Nom de l'équipe", { exact: true }).last().fill(name);
    await page.getByRole("button", { name: "Créer" }).click();
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Supprimer" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmer" })
      .click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(
      0,
    );
  });
});

test("postes : attribuer un poste libre puis le retrouver sur la carte", async ({
  page,
}) => {
  const id = uniqueId();
  await login(page, "admin");
  await page.goto("/collaborateurs/nouveau");
  await page.getByLabel("Prénom").fill("Hélène");
  await page.getByLabel("Nom", { exact: true }).fill(`Poste${id}`);
  await page
    .getByLabel("E-mail professionnel")
    .fill(`helene.${id}@atelier-lumiere.example`);
  await page.getByLabel("Intitulé de poste").fill("Testeuse");
  await page.getByRole("button", { name: "Créer" }).click();
  // La création redirige vers la liste : attendre qu'elle soit terminée avant de changer de page
  await expect(page).toHaveURL(/\/collaborateurs$/);

  await page.goto("/postes?status=free");
  const row = page.locator("tbody tr").first();
  const zoneName = (await row.locator("td").nth(1).innerText()).trim();
  await row.getByRole("combobox").selectOption({ label: `Poste${id} Hélène` });
  // Attendre la réponse de l'action serveur avant de quitter la page (sinon l'attribution peut être abandonnée)
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === "POST" && response.ok(),
    ),
    row.getByRole("button", { name: "Attribuer" }).click(),
  ]);
  await page.goto(`/postes?search=Poste${id}`);
  await expect(
    page.getByRole("row", { name: new RegExp(`Poste${id}`) }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Voir sur la carte" }).first().click();
  await expect(page).toHaveURL(/\/carte\?zone=/);
  await expect(
    page.getByRole("heading", { name: zoneName, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("complementary")).toContainText(
    `Hélène Poste${id}`,
  );
});

test.describe("stock", () => {
  test("la quantité est calculée à partir des mouvements et l'alerte apparaît sous le seuil", async ({
    page,
  }) => {
    const reference = `E2E-${uniqueId()}`;
    const name = `Article ${reference}`;
    await login(page, "manager");
    await createStockItem(page, reference, name, 10);
    await expect(page.getByTestId("quantity")).toContainText("0 unités");
    await expect(page.getByTestId("quantity")).toContainText("Sous le seuil");

    await addMovement(page, "IN", 25, "Réception");
    await expect(page.getByTestId("quantity")).toContainText("25 unités");
    await expect(page.getByTestId("quantity")).not.toContainText(
      "Sous le seuil",
    );

    await addMovement(page, "OUT", 20, "Distribution");
    await expect(page.getByTestId("quantity")).toContainText("5 unités");
    await expect(page.getByTestId("quantity")).toContainText("Sous le seuil");

    await addMovement(page, "ADJUSTMENT", -2, "Inventaire");
    await expect(page.getByTestId("quantity")).toContainText("3 unités");
    await expect(page.getByRole("row", { name: /Inventaire/ })).toBeVisible();

    await page.goto(`/stock?alert=low&search=${reference}`);
    await expect(
      page.getByRole("row", { name: new RegExp(reference) }),
    ).toContainText("Sous le seuil");
  });

  test("une sortie supérieure au stock est refusée", async ({ page }) => {
    const reference = `E2E-${uniqueId()}`;
    await login(page, "manager");
    await createStockItem(page, reference, `Article ${reference}`, 0);
    await addMovement(page, "IN", 3, "Réception");
    await expect(page.getByTestId("quantity")).toContainText("3 unités");
    await addMovement(page, "OUT", 4, "Trop");
    await expect(page.getByTestId("form-error")).toContainText(
      "Stock insuffisant",
    );
    await expect(page.getByTestId("quantity")).toContainText("3 unités");
  });

  test("modification et suppression d'un article avec confirmation", async ({
    page,
  }) => {
    const reference = `E2E-${uniqueId()}`;
    const name = `Article ${reference}`;
    await login(page, "manager");
    await createStockItem(page, reference, name, 5);
    await page.getByRole("link", { name: "Modifier" }).click();
    await expect(
      page.getByRole("heading", { name: "Modifier l'article" }),
    ).toBeVisible();
    await page.getByLabel("Seuil d'alerte").fill("7");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("7", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Supprimer cet article ?",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Annuler" })
      .click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmer" })
      .click();
    await expect(page).toHaveURL(/\/stock$/);
    await page.goto(`/stock?search=${reference}`);
    await expect(page.getByText("Aucun résultat.")).toBeVisible();
  });

  test("référence en double refusée ; l'employé est en lecture seule", async ({
    page,
  }) => {
    const reference = `E2E-${uniqueId()}`;
    await login(page, "manager");
    await createStockItem(page, reference, `Article ${reference}`);
    await page.goto("/stock/nouveau");
    await page.getByLabel("Article", { exact: true }).fill("Doublon");
    await page.getByLabel("Référence").fill(reference);
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByTestId("form-error")).toContainText("déjà utilisée");
    await logout(page);

    await login(page, "employee");
    await page.goto("/stock");
    await expect(
      page.getByRole("link", { name: "Nouvel article" }),
    ).toHaveCount(0);
    await page.goto("/stock/nouveau");
    await expect(page).toHaveURL(/\/stock$/);
  });
});

test.describe("matériel", () => {
  test("création, changement d'état, affectation et historique", async ({
    page,
  }) => {
    const serial = `E2E-${uniqueId()}`;
    await login(page, "manager");
    await page.goto("/materiel/nouveau");
    await page.getByLabel("Type", { exact: true }).fill("Tablette");
    await page.getByLabel("Marque").fill("Marque");
    await page.getByLabel("Modèle").fill("T1");
    await page.getByLabel("N° de série").fill(serial);
    await page.getByLabel("Affecté à").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(
      page.getByRole("heading", { name: /Tablette Marque T1/, level: 1 }),
    ).toBeVisible();

    const stateCard = page.getByRole("region", { name: "Changer l'état" });
    await stateCard.getByLabel("État").selectOption("BROKEN");
    // Attendre la réponse de l'action serveur avant de quitter la page
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST" && response.ok(),
      ),
      stateCard.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    await page.goto(`/materiel?search=${serial}&state=BROKEN`);
    await expect(
      page.getByRole("row", { name: new RegExp(serial) }),
    ).toContainText("En panne");

    await page.getByRole("link", { name: "Tablette" }).click();
    await expect(
      page
        .getByRole("table", { name: "Historique d'affectation" })
        .getByRole("row"),
    ).toHaveCount(2);
    await expect(page.getByText("En cours")).toBeVisible();
  });

  test("numéro de série en double refusé ; suppression avec confirmation", async ({
    page,
  }) => {
    const serial = `E2E-${uniqueId()}`;
    await login(page, "manager");
    const create = async () => {
      await page.goto("/materiel/nouveau");
      await page.getByLabel("Type", { exact: true }).fill("Casque");
      await page.getByLabel("Marque").fill("Marque");
      await page.getByLabel("Modèle").fill("C1");
      await page.getByLabel("N° de série").fill(serial);
      await page.getByRole("button", { name: "Créer" }).click();
    };
    await create();
    await expect(
      page.getByRole("heading", { name: /Casque Marque C1/, level: 1 }),
    ).toBeVisible();
    await create();
    await expect(page.getByTestId("form-error")).toContainText("déjà utilisée");

    await page.goto(`/materiel?search=${serial}`);
    await page.getByRole("link", { name: "Casque" }).click();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmer" })
      .click();
    await expect(page).toHaveURL(/\/materiel$/);
    await page.goto(`/materiel?search=${serial}`);
    await expect(page.getByText("Aucun résultat.")).toBeVisible();
  });

  test("l'employé ne voit que son matériel", async ({ page }) => {
    await login(page, "employee");
    await page.goto("/materiel");
    await expect(
      page.getByText("Vous ne voyez que votre propre matériel."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nouveau matériel" }),
    ).toHaveCount(0);
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toContainText("Ordinateur portable");
    await expect(page.getByText("Serveur NAS")).toHaveCount(0);
  });
});

test.describe("projets", () => {
  test("étapes ordonnées et progression calculée", async ({ page }) => {
    const name = `Projet ${uniqueId()}`;
    await login(page, "manager");
    await page.goto("/projets/nouveau");
    await page.getByLabel("Nom", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    for (const step of ["Cadrage", "Réalisation", "Livraison", "Bilan"]) {
      await page.getByLabel("Nom de l'étape").fill(step);
      await page.getByRole("button", { name: "Ajouter l'étape" }).click();
      await expect(
        page.getByTestId("step").filter({ hasText: step }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("progressbar", { name: `${name} : 0 %` }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Terminée — Cadrage" }).click();
    await expect(
      page.getByRole("progressbar", { name: `${name} : 25 %` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Terminée — Réalisation" }).click();
    await expect(
      page.getByRole("progressbar", { name: `${name} : 50 %` }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Monter — Bilan" }).click();
    await expect(page.getByTestId("step").nth(2)).toContainText("Bilan");
    await expect(page.getByTestId("step").nth(3)).toContainText("Livraison");

    await page.goto("/projets");
    await expect(
      page.getByRole("row", { name: new RegExp(name) }),
    ).toContainText("50 %");
    await page.goto(
      `/carte?project=${(await page.getByRole("link", { name }).getAttribute("href"))?.split("/").pop() ?? ""}`,
    );
  });

  test("suppression d'un projet avec confirmation ; lecture seule pour l'employé", async ({
    page,
  }) => {
    const name = `Projet ${uniqueId()}`;
    await login(page, "manager");
    await page.goto("/projets/nouveau");
    await page.getByLabel("Nom", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Créer" }).click();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmer" })
      .click();
    await expect(page).toHaveURL(/\/projets$/);
    await expect(page.getByRole("link", { name })).toHaveCount(0);
    await logout(page);

    await login(page, "employee");
    await page.goto("/projets");
    await expect(
      page.getByRole("link", { name: "Nouveau projet" }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Migration vers le nouveau réseau" })
      .click();
    await expect(page.getByRole("button", { name: /Terminée —/ })).toHaveCount(
      0,
    );
  });
});

test.describe("carte et données réelles", () => {
  test("le panneau de zone affiche les données de la base et les liens vers les modules", async ({
    page,
  }) => {
    await login(page, "manager");
    await page.goto("/stock?search=PAP-A4");
    await page.getByRole("link", { name: "Voir sur la carte" }).first().click();
    await expect(page).toHaveURL(/\/carte\?zone=/);
    const panel = page.getByRole("complementary");
    await expect(
      panel.getByRole("heading", { name: "Stock", level: 3 }),
    ).toBeVisible();
    await expect(panel).toContainText("Ramettes de papier A4");
    await expect(panel).toContainText("Sous le seuil");
    await panel.getByRole("link", { name: "Mouvement de stock" }).click();
    await expect(page).toHaveURL(/\/stock\?zoneId=/);
  });

  test("la barre de progression suit le projet choisi", async ({ page }) => {
    await login(page, "manager");
    await page.goto("/carte");
    await expect(page.getByTestId("project-bar")).toBeVisible();
    await page
      .getByLabel("Projet affiché")
      .selectOption({ label: "Réaménagement des bureaux" });
    await expect(page.getByTestId("project-progress")).toHaveText("0 %");
  });

  test("l'aperçu d'autres locaux est réservé à ceux qui peuvent aménager", async ({
    page,
  }) => {
    await login(page, "manager");
    await page.goto("/carte?seed=11");
    await expect(page.getByTestId("preview-badge")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enregistrer comme aménagement actif" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Quitter l'aperçu" }).click();
    await expect(page.getByTestId("preview-badge")).toHaveCount(0);
    await logout(page);

    await login(page, "employee");
    await page.goto("/carte?seed=11");
    await expect(page.getByTestId("preview-badge")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Générer de nouveaux locaux" }),
    ).toHaveCount(0);
  });
});

test("toutes les pages de l'application exigent une session", async ({
  page,
}) => {
  for (const path of [
    "/tableau-de-bord",
    "/collaborateurs",
    "/postes",
    "/stock",
    "/materiel",
    "/projets",
    "/carte",
    "/stock/nouveau",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});
