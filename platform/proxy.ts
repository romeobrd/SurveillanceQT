// Aiguillage www / app avant tout rendu (aucune page ne s'affiche puis ne saute ailleurs).
import { NextResponse, type NextRequest } from "next/server";
import {
  desktopRedirect,
  hostRedirect,
  isSessionCookieName,
} from "@/lib/routing/hosts";

export function proxy(request: NextRequest) {
  // Application de bureau : ni accueil ni inscription, on arrive toujours sur la connexion
  if (process.env.SPACORA_EDITION === "desktop") {
    const page = desktopRedirect(request.nextUrl.pathname);
    return page
      ? NextResponse.redirect(new URL(page, request.url), 307)
      : NextResponse.next();
  }
  const target = hostRedirect(
    {
      host: request.headers.get("host"),
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      signedIn: request.cookies
        .getAll()
        .some((cookie) => isSessionCookieName(cookie.name)),
    },
    { siteUrl: process.env.SITE_URL, appUrl: process.env.AUTH_URL },
  );
  // 307 : temporaire (la destination de l'accueil dépend de la session, le navigateur ne la mémorise pas)
  // et conserve la méthode (formulaire envoyé par erreur sur www)
  return target ? NextResponse.redirect(target, 307) : NextResponse.next();
}

export const config = {
  // Ni les API (webhook Stripe, purge), ni les fichiers techniques et images
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
