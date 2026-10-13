import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ImportForm from "@/components/ImportForm";
import { PageHeader, secondaryLink } from "@/components/ui/layout";
import {
  IMPORT_KINDS,
  importColumns,
  type ImportKind,
} from "@/features/import/csv";
import { getAppContext } from "@/lib/app-context";
import { can, type Permission } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

const t = fr.importCsv;

export const metadata: Metadata = { title: `${t.open} — ${fr.app.name}` };

const PERMISSION: Record<ImportKind, Permission> = {
  collaborateurs: "people:write",
  materiel: "asset:write",
  stock: "stock:write",
};

export default async function ImportPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!IMPORT_KINDS.includes(type as ImportKind)) notFound();
  const kind = type as ImportKind;
  const { session } = await getAppContext();
  if (!can(session.role, PERMISSION[kind])) redirect(t.back[kind]);
  return (
    <div className="mx-auto max-w-4xl p-4">
      <PageHeader title={t.titles[kind]}>
        <Link href={t.back[kind]} className={secondaryLink}>
          {fr.common.back}
        </Link>
      </PageHeader>
      <p className="mb-2 text-sm text-slate-700">{t.intro}</p>
      {kind === "collaborateurs" && (
        <p className="mb-2 text-sm text-slate-700">{t.peopleNotice}</p>
      )}
      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">{t.columns}</h2>
        <ul className="mb-3 flex flex-wrap gap-2 text-sm">
          {importColumns(kind).map((column) => (
            <li
              key={column.label}
              className="rounded-md bg-slate-100 px-2 py-1 text-slate-800"
            >
              {column.label}
              {!column.required && (
                <span className="text-slate-600"> ({t.optional})</span>
              )}
            </li>
          ))}
        </ul>
        <a
          href={`/import/${kind}/modele`}
          download
          className="text-brand-700 text-sm font-medium underline"
        >
          {t.template}
        </a>
      </section>
      <ImportForm kind={kind} />
    </div>
  );
}
