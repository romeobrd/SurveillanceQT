import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { getSessionInfo } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";
import {
  installableAppMetadata,
  installableAppViewport,
} from "@/lib/site/app-metadata";

export const metadata: Metadata = {
  ...installableAppMetadata,
  title: `${fr.auth.loginTitle} — ${fr.app.name}`,
};
export const viewport = installableAppViewport;

async function RedirectIfSignedIn() {
  if (await getSessionInfo()) redirect("/tableau-de-bord");
  return null;
}

/** Rappel des comptes du seed, jamais affiché en production (données fictives de développement). */
function DemoAccounts() {
  if (process.env.NODE_ENV === "production") return null;
  const roles = ["admin", "manager", "employee"] as const;
  return (
    <aside
      aria-labelledby="demo-title"
      className="w-full max-w-sm rounded-lg border border-dashed border-slate-300 p-4 text-sm"
    >
      <h2 id="demo-title" className="mb-1 font-semibold">
        {fr.auth.demoTitle}
      </h2>
      <p className="mb-2 text-xs text-slate-600">{fr.auth.demoHelp}</p>
      <ul className="flex flex-col gap-1">
        {roles.map((role) => (
          <li key={role}>
            {fr.auth.demoRoles[role]} :{" "}
            <code>{role}@atelier-lumiere.example</code>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{fr.auth.loginTitle}</h1>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <LoginForm />
      <p className="text-sm text-slate-600">
        {fr.signup.noAccount}{" "}
        <Link
          href="/inscription"
          className="font-medium text-slate-900 underline"
        >
          {fr.signup.startTrial}
        </Link>
      </p>
      <DemoAccounts />
    </main>
  );
}
