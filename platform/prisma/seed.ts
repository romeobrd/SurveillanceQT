import "dotenv/config";
import { seedDevelopment } from "../lib/db/seed";

seedDevelopment()
  .then((organizations) => {
    for (const org of organizations) {
      console.log(
        `${org.name} : ${Object.values(org.accounts)
          .map((account) => account.email)
          .join(", ")}`,
      );
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
