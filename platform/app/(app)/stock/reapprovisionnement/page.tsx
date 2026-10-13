import type { Metadata } from "next";
import Link from "next/link";
import {
  DataTable,
  PageHeader,
  primaryLink,
  secondaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.reorder.title} — ${fr.app.name}`,
};

const t = fr.reorder;

export default async function ReorderPage() {
  const { repos } = await getAppContext();
  const lines = await repos.stock.reorderList();
  return (
    <div className="mx-auto max-w-5xl p-4">
      <PageHeader title={t.title}>
        <Link href="/stock" className={secondaryLink}>
          {fr.common.back}
        </Link>
        {lines.length > 0 && (
          <a
            href="/stock/reapprovisionnement/export"
            download
            className={primaryLink}
          >
            {t.export}
          </a>
        )}
      </PageHeader>
      <p className="mb-1 text-sm text-slate-700">{t.intro}</p>
      {lines.length > 0 && (
        <p className="mb-4 text-xs text-slate-600">{t.exportHelp}</p>
      )}
      <DataTable caption={t.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.stock.name}
            </th>
            <th className={th} scope="col">
              {fr.stock.reference}
            </th>
            <th className={th} scope="col">
              {fr.common.zone}
            </th>
            <th className={th} scope="col">
              {fr.stock.quantity}
            </th>
            <th className={th} scope="col">
              {fr.stock.threshold}
            </th>
            <th className={th} scope="col">
              {t.suggested}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} className={`${td} text-slate-600`}>
                {t.empty}
              </td>
            </tr>
          )}
          {lines.map((line) => (
            <tr key={line.id}>
              <td className={td}>
                <Link
                  href={`/stock/${line.id}`}
                  className="font-medium underline"
                >
                  {line.name}
                </Link>
              </td>
              <td className={td}>{line.reference}</td>
              <td className={td}>{line.zone ?? fr.common.noZone}</td>
              <td className={`${td} font-medium text-red-700 tabular-nums`}>
                {line.quantity} {line.unit}
              </td>
              <td className={`${td} tabular-nums`}>{line.threshold}</td>
              <td className={`${td} font-semibold tabular-nums`}>
                {line.suggested} {line.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
