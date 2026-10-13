import "dotenv/config";
import { resetE2eOrganization } from "../lib/db/seed";

resetE2eOrganization()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
