import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getSessionInfo } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";
import { homeAfterLogin } from "@/lib/edition";
import {
  contactEmail,
  landingTexts,
  signupHref,
  staticSite,
} from "@/lib/site/mode";

const t = fr.landing;
const navLink =
  "rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600";
export const ctaClass =
  "inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

/** Déjà connecté : accès direct à son espace ; sinon lien de connexion. Lu à la requête (cookie de session). */
async function AccountLink() {
  return (await getSessionInfo()) ? (
    <Link href={homeAfterLogin()} className={navLink}>
      {t.nav.mySpace}
    </Link>
  ) : (
    <Link href="/login" className={navLink}>
      {t.nav.login}
    </Link>
  );
}

/** En-tête et pied de page du site public (accueil, tarifs, pages légales). */
export default function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link
            href="/"
            className="mr-4 flex items-center gap-2 text-lg font-bold"
          >
            <span
              aria-hidden="true"
              className="bg-brand-600 inline-block h-6 w-6 rotate-45 rounded-sm"
            />
            {fr.app.name}
          </Link>
          <nav
            aria-label={fr.nav.label}
            className="flex flex-wrap items-center gap-1"
          >
            <Link href="/#fonctionnalites" className={navLink}>
              {t.nav.features}
            </Link>
            <Link href="/#tarifs" className={navLink}>
              {t.nav.pricing}
            </Link>
            <Link href="/#rgpd" className={navLink}>
              {t.nav.privacy}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* Site vitrine statique : pas de connexion (le service n'est pas en ligne) */}
            {!staticSite && (
              <Suspense
                fallback={
                  <Link href="/login" className={navLink}>
                    {t.nav.login}
                  </Link>
                }
              >
                <AccountLink />
              </Suspense>
            )}
            <a
              href={signupHref(t.static.mailSubject)}
              className={`${ctaClass} px-4 py-2 text-sm`}
            >
              {landingTexts().cta}
            </a>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-slate-600">
          <span>© 2026 {fr.app.name}</span>
          <Link href="/mentions-legales" className="hover:underline">
            {t.footer.legal}
          </Link>
          {/* CGU et CGV concernent le service : absentes du site vitrine statique */}
          {!staticSite && (
            <>
              <Link href="/cgu" className="hover:underline">
                {t.footer.terms}
              </Link>
              <Link href="/cgv" className="hover:underline">
                {t.footer.sales}
              </Link>
            </>
          )}
          <Link href="/confidentialite" className="hover:underline">
            {t.footer.privacy}
          </Link>
          {staticSite ? (
            <a
              href={`mailto:${contactEmail}`}
              className="ml-auto hover:underline"
            >
              {t.static.contact} : {contactEmail}
            </a>
          ) : (
            <Link href="/login" className="ml-auto hover:underline">
              {t.footer.login}
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
