import "dotenv/config";
import { runPurge } from "../lib/db/purge";

// Purge nocturne en ligne de commande : `npm run purge` (à planifier avec cron, voir deploy/).
runPurge()
  .then((report) => {
    console.log(JSON.stringify(report));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
