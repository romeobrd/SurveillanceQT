// Aiguillage www / app avant tout rendu (aucune page ne s'affiche puis ne saute ailleurs).
import { NextResponse, type NextRequest } from "next/server";
import { hostRedirect, isSessionCookieName } from "@/lib/routing/hosts";

export function proxy(request: NextRequest) {
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
