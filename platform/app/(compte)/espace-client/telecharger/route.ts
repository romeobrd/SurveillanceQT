// Téléchargement de l'application de bureau : réservé aux clients dont l'abonnement payé est en cours.
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { ForbiddenError, getRepositories } from "@/lib/db";

/** Installateur Windows publié par la construction automatique (GitHub Actions), modifiable par DESKTOP_DOWNLOAD_URL. */
const DEFAULT_DOWNLOAD_URL =
  "https://github.com/romeobrd/SurveillanceQT/releases/download/desktop-demo/Spacora-Setup.exe";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const allowed = await getRepositories(session)
    .billing.recordDesktopDownload()
    .catch((error: unknown) => {
      // Rôle sans accès à l'abonnement : retour à l'espace client
      if (error instanceof ForbiddenError) return false;
      throw error;
    });
  if (!allowed)
    return NextResponse.redirect(new URL("/espace-client", request.url));
  return NextResponse.redirect(
    process.env.DESKTOP_DOWNLOAD_URL ?? DEFAULT_DOWNLOAD_URL,
  );
}
