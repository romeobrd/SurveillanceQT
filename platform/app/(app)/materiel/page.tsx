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
import { AssetQuerySchema, ASSET_STATES } from "@/features/assets/schemas";
import { firstValues } from "@/features/list-query";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.assets.title} — ${fr.app.name}`,
};

const tones = {
  IN_SERVICE: "ok",
  BROKEN: "alert",
  TO_RENEW: "warn",
  RETIRED: "neutral",
} as const;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = AssetQuerySchema.parse(firstValues(await searchParams));
  const { session, repos } = await getAppContext();
  const canWrite = can(session.role, "asset:write");
  const [assets, zones] = await Promise.all([
    repos.assets.list(query),
    repos.zones.list(),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <PageHeader title={fr.assets.title}>
        {canWrite && (
          <>
            <Link href="/import/materiel" className={secondaryLink}>
              {fr.importCsv.open}
            </Link>
            <Link href="/materiel/nouveau" className={primaryLink}>
              {fr.assets.new}
            </Link>
          </>
        )}
      </PageHeader>
      {!canWrite && (
        <p className="mb-3 text-sm text-slate-600">{fr.assets.onlyMine}</p>
      )}
      <FilterForm action="/materiel">
        <FilterInput
          id="search"
          label={fr.common.search}
          defaultValue={query.search}
        />
        <FilterSelect
          id="state"
          label={fr.assets.state}
          value={query.state}
          options={[
            { value: "ALL", label: fr.common.all },
            ...ASSET_STATES.map((state) => ({
              value: state,
              label: fr.assets.states[state],
            })),
          ]}
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
          id="sort"
          label={fr.common.sortBy}
          value={query.sort}
          options={Object.entries(fr.assets.sortOptions).map(
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

      <DataTable caption={fr.assets.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.assets.type}
            </th>
            <th className={th} scope="col">
              {fr.assets.brand}
            </th>
            <th className={th} scope="col">
              {fr.assets.model}
            </th>
            <th className={th} scope="col">
              {fr.assets.serialNumber}
            </th>
            <th className={th} scope="col">
              {fr.assets.state}
            </th>
            <th className={th} scope="col">
              {fr.assets.person}
            </th>
            <th className={th} scope="col">
              {fr.assets.zone}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.length === 0 && <EmptyRow colSpan={8} />}
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className={td}>
                <Link
                  href={`/materiel/${asset.id}`}
                  className="font-medium underline"
                >
                  {asset.type}
                </Link>
              </td>
              <td className={td}>{asset.brand}</td>
              <td className={td}>{asset.model}</td>
              <td className={td}>{asset.serialNumber}</td>
              <td className={td}>
                <Badge tone={tones[asset.state]}>
                  {fr.assets.states[asset.state]}
                </Badge>
              </td>
              <td className={td}>{asset.personName ?? fr.assets.unassigned}</td>
              <td className={td}>{asset.zoneName ?? fr.common.noZone}</td>
              <td className={td}>
                {asset.zoneKey && (
                  <Link
                    href={`/carte?zone=${asset.zoneKey}`}
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
