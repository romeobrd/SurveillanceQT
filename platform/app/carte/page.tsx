import type { Metadata } from "next";
import { Suspense } from "react";
import MapExplorer from "@/components/MapExplorer";
import type { Role as UiRole } from "@/features/map/types";
import { requirePermission } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.map.pageTitle} — ${fr.app.name}`,
};

const UI_ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employe",
} as const satisfies Record<string, UiRole>;

async function AuthenticatedMap() {
  // Accès vérifié côté serveur à chaque requête : session valide + droit de lecture de la carte
  const session = await requirePermission("map:read");
  return (
    <MapExplorer
      role={UI_ROLES[session.role]}
      organizationName={session.organizationName}
    />
  );
}

export default function CartePage() {
  return (
    <Suspense fallback={<p className="p-8">{fr.map.loading}</p>}>
      <AuthenticatedMap />
    </Suspense>
  );
}
