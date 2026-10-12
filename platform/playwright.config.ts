import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      // CHROMIUM_PATH : navigateur déjà installé (environnements sans téléchargement)
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // Rendu WebGL logiciel pour les machines sans GPU (CI, conteneurs)
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
