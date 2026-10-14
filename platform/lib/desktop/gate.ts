// Application de bureau : étape à franchir avant d'utiliser Spacora (activation, création de l'entreprise).
import "server-only";
import { connection } from "next/server";
import { localOrganizationExists } from "@/lib/db/desktop-local";
import { edition } from "@/lib/edition";
import { currentLicence } from "./licence-store";

/** Page où envoyer l'utilisateur, ou null si l'application est prête. Toujours null hors édition « desktop ». */
export async function desktopGate(
  options: { requireOrganization?: boolean } = {},
): Promise<string | null> {
  if (edition() !== "desktop") return null;
  // Contrôle fait à chaque requête (date, fichier de licence), jamais au pré-rendu
  await connection();
  const licence = await currentLicence();
  if (licence.state === "missing") return "/activation";
  if (licence.state !== "valid")
    return `/activation?raison=${licence.state === "inactive" ? licence.reason : licence.state}`;
  if (
    options.requireOrganization !== false &&
    !(await localOrganizationExists())
  )
    return "/demarrage";
  return null;
}
