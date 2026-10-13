import type { Metadata } from "next";
import { fr } from "@/lib/i18n/fr";
import "./globals.css";

export const metadata: Metadata = {
  title: fr.app.name,
  description: fr.app.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
