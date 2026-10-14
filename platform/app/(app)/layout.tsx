import { Suspense, type ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import AppNav from "@/components/AppNav";
import InstallAppButton from "@/components/InstallAppButton";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { emailAvailable } from "@/lib/email/send";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desktopGate } from "@/lib/desktop/gate";
import { edition, siteHomeHref } from "@/lib/edition";
import { requireSessionAllowingPasswordChange } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";
import {
  installableAppMetadata,
  installableAppViewport,
} from "@/lib/site/app-metadata";

export const metadata = installableAppMetadata;
export const viewport = installableAppViewport;

const ROLE_LABELS = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employe",
} as const;

async function AppShell({ children }: { children: ReactNode }) {
  // Session exigée pour toutes les pages de l'application, vérifiée côté serveur à chaque requête
  // Mot de passe provisoire : la mise en page s'affiche, mais seules « Mon compte » et la déconnexion sont proposées
  const session = await requireSessionAllowingPasswordChange();
  // Site + espace client (boutique) : l'application elle-même est l'application de bureau
  if (edition() === "boutique") redirect("/espace-client");
  // Application de bureau : licence vérifiée (contrôle en ligne toutes les 12 h, 14 jours hors ligne)
  const step = await desktopGate();
  if (step) redirect(step);
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2">
        {/* Retour au site vitrine (sur son propre domaine en production : SITE_URL) */}
        <a
          href={siteHomeHref()}
          target={edition() === "desktop" ? "_blank" : undefined}
          rel={edition() === "desktop" ? "noopener" : undefined}
          aria-label={fr.app.homeLink}
          title={fr.app.homeLink}
          className="focus-visible:outline-brand-600 flex items-center gap-2 rounded-md font-semibold focus-visible:outline-2"
        >
          <span
            aria-hidden="true"
            className="bg-brand-600 inline-block h-4 w-4 rotate-45 rounded-sm"
          />
          {fr.app.name}
        </a>
        {!session.mustChangePassword && (
          <AppNav isAdmin={session.role === "ADMIN"} />
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <InstallAppButton />
          <span>
            {session.organizationName} ·{" "}
            <span data-testid="role">
              {fr.map.roles[ROLE_LABELS[session.role]]}
            </span>
          </span>
          <Link
            href="/mon-compte"
            className="focus-visible:outline-brand-600 rounded-md px-2 py-1.5 hover:bg-slate-100 focus-visible:outline-2"
          >
            {fr.myAccount.link}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="focus-visible:outline-brand-600 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-2"
            >
              {fr.auth.logout}
            </button>
          </form>
        </div>
      </header>
      {!session.emailVerified && emailAvailable() && <VerifyEmailBanner />}
      {(session.access === "readonly" || session.trialDaysLeft > 0) && (
        <p
          role="status"
          data-testid="billing-banner"
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm ${
            session.access === "readonly"
              ? "bg-red-50 text-red-900"
              : "bg-brand-50 text-brand-900"
          }`}
        >
          {session.access === "readonly"
            ? fr.billing.bannerReadonly
            : fr.billing.bannerTrial.replace(
                "{days}",
                String(session.trialDaysLeft),
              )}
          {session.role === "ADMIN" && (
            <Link
              href="/administration/abonnement"
              className="font-medium underline"
            >
              {fr.billing.bannerCta}
            </Link>
          )}
        </p>
      )}
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8">{fr.map.loading}</p>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
