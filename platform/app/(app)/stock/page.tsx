import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  DataTable,
  EmptyRow,
  FilterForm,
  FilterInput,
  FilterSelect,
  PageHeader,
  primaryLink,
  secondaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { StockQuerySchema } from "@/features/stock/schemas";
import { firstValues } from "@/features/list-query";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.stock.title} — ${fr.app.name}`,
};

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = StockQuerySchema.parse(firstValues(await searchParams));
  const { session, repos } = await getAppContext();
  const [items, zones] = await Promise.all([
    repos.stock.listItems(query),
    repos.zones.list(),
  ]);
  const canWrite = can(session.role, "stock:write");

  return (
    <div className="mx-auto max-w-6xl p-4">
      <PageHeader title={fr.stock.title}>
        <Link href="/stock/reapprovisionnement" className={secondaryLink}>
          {fr.reorder.open}
        </Link>
        {canWrite && (
          <>
            <Link href="/import/stock" className={secondaryLink}>
              {fr.importCsv.open}
            </Link>
            <Link href="/stock/nouveau" className={primaryLink}>
              {fr.stock.new}
            </Link>
          </>
        )}
      </PageHeader>
      <FilterForm action="/stock">
        <FilterInput
          id="search"
          label={fr.common.search}
          defaultValue={query.search}
        />
        <FilterSelect
          id="zoneId"
          label={fr.common.zone}
          value={query.zoneId}
          options={[
            { value: "", label: fr.common.all },
            ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
          ]}
        />
        <FilterSelect
          id="alert"
          label={fr.stock.alertFilter}
          value={query.alert}
          options={[
            { value: "all", label: fr.common.all },
            { value: "low", label: fr.stock.onlyLow },
          ]}
        />
        <FilterSelect
          id="sort"
          label={fr.common.sortBy}
          value={query.sort}
          options={Object.entries(fr.stock.sortOptions).map(
            ([value, label]) => ({ value, label }),
          )}
        />
        <FilterSelect
          id="dir"
          label={fr.common.direction}
          value={query.dir}
          options={[
            { value: "asc", label: fr.common.asc },
            { value: "desc", label: fr.common.desc },
          ]}
        />
      </FilterForm>

      <DataTable caption={fr.stock.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.stock.reference}
            </th>
            <th className={th} scope="col">
              {fr.stock.name}
            </th>
            <th className={th} scope="col">
              {fr.stock.quantity}
            </th>
            <th className={th} scope="col">
              {fr.stock.threshold}
            </th>
            <th className={th} scope="col">
              {fr.common.zone}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow colSpan={6} />}
          {items.map((item) => (
            <tr key={item.id}>
              <td className={td}>{item.reference}</td>
              <td className={td}>
                <Link
                  href={`/stock/${item.id}`}
                  className="font-medium underline"
                >
                  {item.name}
                </Link>
              </td>
              <td className={td}>
                {item.quantity} {item.unit}{" "}
                {item.isLow && (
                  <Badge tone="alert">
                    <span aria-hidden="true">⚠ </span>
                    {fr.stock.belowThreshold}
                  </Badge>
                )}
              </td>
              <td className={td}>{item.threshold}</td>
              <td className={td}>{item.zoneName ?? fr.common.noZone}</td>
              <td className={td}>
                {item.zoneKey && (
                  <Link
                    href={`/carte?zone=${item.zoneKey}`}
                    className="text-brand-800 underline"
                  >
                    {fr.common.viewOnMap}
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
