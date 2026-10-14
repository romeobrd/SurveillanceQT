// Spacora installable comme une application (icône sur le bureau, fenêtre dédiée) depuis Chrome ou Edge.
// Uniquement sur les pages du service : le site vitrine n'est pas une application à installer.
import type { Metadata, Viewport } from "next";

export const installableAppMetadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Spacora", statusBarStyle: "default" },
  icons: { apple: "/icons/spacora-180.png" },
};

export const installableAppViewport: Viewport = { themeColor: "#ea580c" };
