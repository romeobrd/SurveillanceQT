import Link from "next/link";
import { fr } from "@/lib/i18n/fr";

const TABS = [
  { href: "/administration", label: fr.admin.sectionSettings },
  { href: "/administration/demandes", label: fr.admin.sectionRequests },
  { href: "/administration/journal", label: fr.admin.sectionJournal },
] as const;

/** Sous-navigation de l'administration. */
export default function AdminTabs({ current }: { current: string }) {
  return (
    <nav aria-label={fr.admin.title} className="mb-4 flex flex-wrap gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-orange-600 ${
            tab.href === current
              ? "bg-orange-100 text-orange-900"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
