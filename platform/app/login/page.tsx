import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { getSessionInfo } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.auth.loginTitle} — ${fr.app.name}`,
};

async function RedirectIfSignedIn() {
  if (await getSessionInfo()) redirect("/tableau-de-bord");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{fr.auth.loginTitle}</h1>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <LoginForm />
    </main>
  );
}
