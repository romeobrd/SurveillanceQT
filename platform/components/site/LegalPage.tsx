import Link from "next/link";
import type { ReactNode } from "react";
import SiteChrome from "./SiteChrome";
import { fr } from "@/lib/i18n/fr";

export interface LegalSection {
  title: string;
  paragraphs: readonly ReactNode[];
}

/** Page légale du site public : toujours marquée « modèle à faire valider ». */
export default function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: readonly LegalSection[];
}) {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">{title}</h1>
        <p className="mb-4 text-sm text-slate-600">{fr.legal.updated}</p>
        <p
          role="note"
          className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {fr.legal.draft}
        </p>
        {sections.map((section) => (
          <section key={section.title} className="mb-6">
            <h2 className="mb-2 text-xl font-semibold">{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="mb-2 text-slate-700">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <Link href="/" className="text-sm underline">
          {fr.legal.back}
        </Link>
      </article>
    </SiteChrome>
  );
}
