import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const outsideDb = ["lib/db/**", "prisma/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Aucune requête Prisma hors de lib/db : tout passe par la couche d'accès multi-tenant (CLAUDE.md)
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: outsideDb,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/*",
                "**/db/generated",
                "**/db/generated/**",
                "@/lib/db/client",
                "**/db/client",
              ],
              message:
                "Accès Prisma interdit hors de lib/db : utiliser getRepositories() (couche multi-tenant).",
            },
          ],
        },
      ],
    },
  },
  // Les accès pré-authentification et la portée multi-tenant ne sont utilisables que par lib/auth et les tests
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: [...outsideDb, "lib/auth/**", "tests/**", "app/api/cron/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/*",
                "**/db/generated",
                "**/db/generated/**",
                "@/lib/db/client",
                "**/db/client",
              ],
              message:
                "Accès Prisma interdit hors de lib/db : utiliser getRepositories() (couche multi-tenant).",
            },
            {
              group: [
                "@/lib/db/tenant",
                "@/lib/db/auth-store",
                "@/lib/db/scope",
                "@/lib/db/testing",
                "@/lib/db/seed",
                "@/lib/db/purge",
                "@/lib/db/privacy-core",
              ],
              message: "Utiliser getRepositories(contexte) depuis @/lib/db.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/db/generated/**",
  ]),
]);

export default eslintConfig;
