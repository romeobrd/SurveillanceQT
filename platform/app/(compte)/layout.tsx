import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { logoutAction } from "@/app/login/actions";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { requireSessionAllowingPasswordChange } from "@/lib/auth/session";
import { emailAvailable } from "@/lib/email/send";
import { fr } from "@/lib/i18n/fr";

const t = fr.clientArea;

/** Espace client du site (édition « boutique ») : abonnement et téléchargement de l'application de bureau. */
async function AccountShell({ children }: { children: ReactNode }) {
  const session = await requireSessionAllowingPasswordChange();
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="focus-visible:outline-brand-600 flex items-center gap-2 rounded-md text-lg font-bold focus-visible:outline-2"
          >
            <span
              aria-hidden="true"
              className="bg-brand-600 inline-block h-5 w-5 rotate-45 rounded-sm"
            />
            {fr.app.name}
          </Link>
          <span className="text-sm text-slate-600">{t.title}</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span>{session.organizationName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="focus-visible:outline-brand-600 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-2"
              >
                {t.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      {!session.emailVerified && emailAvailable() && <VerifyEmailBanner />}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AccountShell>{children}</AccountShell>
    </Suspense>
  );
}
