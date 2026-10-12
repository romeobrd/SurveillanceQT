import { fr } from "@/lib/i18n/fr";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-3xl font-semibold">{fr.app.homeTitle}</h1>
      <p className="text-zinc-600">{fr.app.homeSubtitle}</p>
    </main>
  );
}
