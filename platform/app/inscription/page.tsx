import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SignupForm from "@/components/SignupForm";
import { getSessionInfo } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";
import {
  installableAppMetadata,
  installableAppViewport,
} from "@/lib/site/app-metadata";

export const metadata: Metadata = {
  ...installableAppMetadata,
  title: `${fr.signup.title} — ${fr.app.name}`,
};
export const viewport = installableAppViewport;

async function RedirectIfSignedIn() {
  if (await getSessionInfo()) redirect("/tableau-de-bord");
  return null;
}

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{fr.signup.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{fr.signup.subtitle}</p>
      </div>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <SignupForm />
    </main>
  );
}
