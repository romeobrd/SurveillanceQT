import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionInfo } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";

async function RedirectIfSignedIn() {
  if (await getSessionInfo()) redirect("/tableau-de-bord");
  return null;
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">{fr.app.homeTitle}</h1>
      <p className="text-zinc-600">{fr.app.homeSubtitle}</p>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <Link
        href="/login"
        className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {fr.auth.submit}
      </Link>
    </main>
  );
}
