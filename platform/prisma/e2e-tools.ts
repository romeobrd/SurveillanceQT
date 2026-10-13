// Outils des tests e2e uniquement (jamais en production) : simuler le temps qui passe sur un abonnement.
import "dotenv/config";
import { expireTrial } from "../lib/db/testing";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Outil de test interdit en production.");
  const [command, email] = process.argv.slice(2);
  if (command === "expire-trial" && email) {
    await expireTrial(email);
    return;
  }
  throw new Error("Usage : e2e-tools expire-trial <email-admin>");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
