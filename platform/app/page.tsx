import Link from "next/link";
import { fr } from "@/lib/i18n/fr";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">{fr.app.homeTitle}</h1>
      <p className="text-zinc-600">{fr.app.homeSubtitle}</p>
      <Link
        href="/carte"
        className="rounded-md bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
      >
        {fr.app.openMap}
      </Link>
    </main>
  );
}
