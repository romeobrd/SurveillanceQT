import { fr } from "@/lib/i18n/fr";

// Frontière de chargement sous le layout partagé : les navigations entre pages restent instantanées
export default function Loading() {
  return (
    <p role="status" className="p-8 text-slate-600">
      {fr.map.loading}
    </p>
  );
}
