import Link from "next/link";
import { fr } from "@/lib/i18n/fr";

const TABS = [
  { href: "/administration", label: fr.admin.sectionSettings },
  { href: "/administration/comptes", label: fr.accounts.tab },
  { href: "/administration/abonnement", label: fr.billing.tab },
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
          className={`focus-visible:outline-brand-600 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 ${
            tab.href === current
              ? "bg-brand-100 text-brand-900"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
