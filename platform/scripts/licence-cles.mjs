// Crée la paire de clés des licences de l'application de bureau (Ed25519).
// - clé PRIVÉE : ajoutée au fichier .env (DESKTOP_LICENCE_PRIVATE_KEY) ; elle ne quitte jamais ce fichier ;
// - clé PUBLIQUE : écrite dans lib/desktop/licence-public-key.ts et affichée (rien de secret).
// Refuse de remplacer une clé existante : toutes les licences déjà accordées deviendraient invalides.
// Usage : npm run licence:cles
import { generateKeyPairSync } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(".env");
const keyFile = resolve("lib/desktop/licence-public-key.ts");
const env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";

if (/^\s*DESKTOP_LICENCE_PRIVATE_KEY\s*=/m.test(env)) {
  console.error(
    "Une clé de licence existe déjà dans .env : rien n'a été modifié.\n" +
      "La remplacer invaliderait toutes les licences déjà accordées.",
  );
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateBase64 = privateKey
  .export({ format: "der", type: "pkcs8" })
  .toString("base64");
const publicBase64 = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");

appendFileSync(
  envFile,
  `${env && !env.endsWith("\n") ? "\n" : ""}\n# Clé privée des licences de l'application de bureau : NE JAMAIS LA PARTAGER\nDESKTOP_LICENCE_PRIVATE_KEY="${privateBase64}"\n`,
);
writeFileSync(
  keyFile,
  readFileSync(keyFile, "utf8").replace(
    /export const LICENCE_PUBLIC_KEY: string \| null = .*;/,
    `export const LICENCE_PUBLIC_KEY: string | null =\n  "${publicBase64}";`,
  ),
);

console.log("Clés créées.");
console.log("  - Clé privée ajoutée à .env (à garder secrète, à sauvegarder).");
console.log("  - Clé publique écrite dans lib/desktop/licence-public-key.ts.");
console.log("");
console.log("Clé PUBLIQUE (rien de secret, à intégrer au logiciel) :");
console.log(publicBase64);
