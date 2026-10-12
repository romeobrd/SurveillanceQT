import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteAssetAction,
  setAssetStateAction,
  updateAssetAction,
} from "../actions";
import AssetFields from "@/components/AssetForm";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SelectField } from "@/components/ui/fields";
import {
  Badge,
  Card,
  DataTable,
  secondaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { ASSET_STATES } from "@/features/assets/schemas";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.assets.title} — ${fr.app.name}`,
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeZone: "Europe/Paris",
});
const tones = {
  IN_SERVICE: "ok",
  BROKEN: "alert",
  TO_RENEW: "warn",
  RETIRED: "neutral",
} as const;

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, repos } = await getAppContext();
  const detail = await repos.assets.getDetail(id);
  if (!detail) notFound();
  const { asset, history } = detail;
  const canWrite = can(session.role, "asset:write");
  const [people, zones] = canWrite
    ? await Promise.all([
        repos.people.list({ status: "ACTIVE" }),
        repos.zones.list(),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {asset.type} {asset.brand} {asset.model}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/materiel" className={secondaryLink}>
            {fr.common.back}
          </Link>
          {asset.zoneKey && (
            <Link
              href={`/carte?zone=${asset.zoneKey}`}
              className={secondaryLink}
            >
              {fr.common.viewOnMap}
            </Link>
          )}
          {canWrite && (
            <ConfirmDialog
              triggerLabel={fr.common.delete}
              title={fr.assets.deleteTitle}
              description={fr.assets.deleteBody}
              action={deleteAssetAction}
            >
              <input type="hidden" name="id" value={asset.id} />
            </ConfirmDialog>
          )}
        </div>
      </div>

      <p className="mb-4 flex items-center gap-2 text-sm">
        <Badge tone={tones[asset.state]}>{fr.assets.states[asset.state]}</Badge>
        <span>
          {asset.personName ?? fr.assets.unassigned} ·{" "}
          {asset.zoneName ?? fr.common.noZone}
        </span>
      </p>

      {canWrite && (
        <div className="mb-6 grid gap-4">
          <Card title={fr.assets.changeState}>
            <ActionForm
              action={setAssetStateAction}
              submitLabel={fr.common.save}
              className="flex items-end gap-3"
            >
              <input type="hidden" name="id" value={asset.id} />
              <SelectField
                id="state"
                label={fr.assets.state}
                defaultValue={asset.state}
                options={ASSET_STATES.map((state) => ({
                  value: state,
                  label: fr.assets.states[state],
                }))}
              />
            </ActionForm>
          </Card>
          <Card title={fr.assets.editTitle}>
            <ActionForm action={updateAssetAction}>
              <input type="hidden" name="id" value={asset.id} />
              <AssetFields people={people} zones={zones} defaults={asset} />
            </ActionForm>
          </Card>
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">{fr.assets.history}</h2>
      <DataTable caption={fr.assets.history}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.assets.person}
            </th>
            <th className={th} scope="col">
              {fr.assets.zone}
            </th>
            <th className={th} scope="col">
              {fr.assets.from}
            </th>
            <th className={th} scope="col">
              {fr.assets.until}
            </th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr>
              <td colSpan={4} className={`${td} text-slate-600`}>
                {fr.assets.noHistory}
              </td>
            </tr>
          )}
          {history.map((entry) => (
            <tr key={entry.id}>
              <td className={td}>{entry.personName ?? fr.assets.unassigned}</td>
              <td className={td}>{entry.zoneName ?? fr.common.noZone}</td>
              <td className={td}>{dateFormat.format(entry.assignedAt)}</td>
              <td className={td}>
                {entry.releasedAt
                  ? dateFormat.format(entry.releasedAt)
                  : fr.assets.current}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
