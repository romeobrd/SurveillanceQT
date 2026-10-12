import { Suspense, type ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import AppNav from "@/components/AppNav";
import { requireSession } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";

const ROLE_LABELS = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employe",
} as const;

async function AppShell({ children }: { children: ReactNode }) {
  // Session exigée pour toutes les pages de l'application, vérifiée côté serveur à chaque requête
  const session = await requireSession();
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2">
        <span className="font-semibold">{fr.app.name}</span>
        <AppNav />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>
            {session.organizationName} ·{" "}
            <span data-testid="role">
              {fr.map.roles[ROLE_LABELS[session.role]]}
            </span>
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600"
            >
              {fr.auth.logout}
            </button>
          </form>
        </div>
      </header>
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
