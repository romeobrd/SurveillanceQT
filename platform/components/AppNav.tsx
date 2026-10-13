"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/lib/i18n/fr";

const ITEMS = [
  { href: "/tableau-de-bord", label: fr.nav.dashboard },
  { href: "/carte", label: fr.nav.map },
  { href: "/collaborateurs", label: fr.nav.people },
  { href: "/postes", label: fr.nav.workstations },
  { href: "/stock", label: fr.nav.stock },
  { href: "/materiel", label: fr.nav.assets },
  { href: "/projets", label: fr.nav.projects },
  { href: "/mes-donnees", label: fr.nav.privacy },
] as const;

const ADMIN_ITEM = { href: "/administration", label: fr.nav.admin } as const;

export default function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={fr.nav.label}>
      <ul className="flex flex-wrap gap-1">
        {(isAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS).map((item) => {
          const current =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-orange-600 ${
                  current
                    ? "bg-orange-100 text-orange-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
