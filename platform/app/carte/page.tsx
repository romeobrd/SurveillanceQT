import type { Metadata } from "next";
import { Suspense } from "react";
import MapExplorer from "@/components/MapExplorer";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.map.pageTitle} — ${fr.app.name}`,
};

export default function CartePage() {
  return (
    <Suspense fallback={null}>
      <MapExplorer />
    </Suspense>
  );
}
