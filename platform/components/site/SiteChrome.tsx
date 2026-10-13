import Link from "next/link";
import type { ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";

const t = fr.landing;
const navLink =
  "rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600";
export const ctaClass =
  "inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

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
            <Link href="/login" className={navLink}>
              {t.nav.login}
            </Link>
            <Link
              href="/inscription"
              className={`${ctaClass} px-4 py-2 text-sm`}
            >
              {t.cta}
            </Link>
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
          <Link href="/cgu" className="hover:underline">
            {t.footer.terms}
          </Link>
          <Link href="/cgv" className="hover:underline">
            {t.footer.sales}
          </Link>
          <Link href="/confidentialite" className="hover:underline">
            {t.footer.privacy}
          </Link>
          <Link href="/login" className="ml-auto hover:underline">
            {t.footer.login}
          </Link>
        </div>
      </footer>
    </div>
  );
}
