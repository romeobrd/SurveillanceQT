// Spacora installable comme une application (Chrome, Edge) depuis le service, pas depuis le site vitrine.
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("le service est installable : fiche d'application, icônes, aucune erreur d'installabilité", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "Spacora",
    display: "standalone",
    start_url: "/tableau-de-bord",
  });
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).status()).toBe(200);

  // Vérification faite par Chromium lui-même avant de proposer « Installer »
  await login(page, "manager");
  const cdp = await page.context().newCDPSession(page);
  await expect
    .poll(async () => {
      const { installabilityErrors } = await cdp.send(
        "Page.getInstallabilityErrors",
      );
      // « in-incognito » : le navigateur de test est toujours en navigation privée, jamais celui d'un client
      return installabilityErrors
        .map((error) => error.errorId)
        .filter((id) => id !== "in-incognito");
    })
    .toEqual([]);
});

test("le site vitrine n'est pas proposé comme application à installer", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});
