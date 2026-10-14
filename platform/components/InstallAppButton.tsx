"use client";

// Bouton « Installer l'application » : proposé par Chrome et Edge quand Spacora peut être installé
// (icône sur le bureau, fenêtre dédiée). Invisible ailleurs et une fois l'application installée.
import { useEffect, useState } from "react";
import { fr } from "@/lib/i18n/fr";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Le navigateur proposera l'installation au clic sur notre bouton, pas de lui-même
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (!installEvent) return null;
  return (
    <button
      type="button"
      data-testid="install-app"
      onClick={async () => {
        await installEvent.prompt();
        await installEvent.userChoice;
        setInstallEvent(null);
      }}
      className="border-brand-300 text-brand-800 hover:bg-brand-50 focus-visible:outline-brand-600 rounded-md border px-2 py-1.5 font-medium focus-visible:outline-2"
    >
      {fr.app.install}
    </button>
  );
}
