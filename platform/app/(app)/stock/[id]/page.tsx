import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addMovementAction, deleteStockItemAction } from "../actions";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SelectField, TextInput } from "@/components/ui/fields";
import {
  Badge,
  Card,
  DataTable,
  EmptyRow,
  primaryLink,
  secondaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.stock.title} — ${fr.app.name}`,
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function StockItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, repos } = await getAppContext();
  const detail = await repos.stock.getItem(id);
  if (!detail) notFound();
  const { item, movements } = detail;
  const canWrite = can(session.role, "stock:write");

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{item.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/stock" className={secondaryLink}>
            {fr.common.back}
          </Link>
          {item.zoneKey && (
            <Link
              href={`/carte?zone=${item.zoneKey}`}
              className={secondaryLink}
            >
              {fr.common.viewOnMap}
            </Link>
          )}
          {canWrite && (
            <>
              <Link href={`/stock/${item.id}/modifier`} className={primaryLink}>
                {fr.common.edit}
              </Link>
              <ConfirmDialog
                triggerLabel={fr.common.delete}
                title={fr.stock.deleteTitle}
                description={fr.stock.deleteBody}
                action={deleteStockItemAction}
              >
                <input type="hidden" name="id" value={item.id} />
              </ConfirmDialog>
            </>
          )}
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-slate-600">{fr.stock.reference}</dt>
          <dd className="font-medium">{item.reference}</dd>
        </div>
        <div>
          <dt className="text-slate-600">{fr.stock.currentQuantity}</dt>
          <dd className="font-medium" data-testid="quantity">
            {item.quantity} {item.unit}{" "}
            {item.isLow && (
              <Badge tone="alert">
                <span aria-hidden="true">⚠ </span>
                {fr.stock.belowThreshold}
              </Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">{fr.stock.threshold}</dt>
          <dd className="font-medium">{item.threshold}</dd>
        </div>
        <div>
          <dt className="text-slate-600">{fr.common.zone}</dt>
          <dd className="font-medium">{item.zoneName ?? fr.common.noZone}</dd>
        </div>
      </dl>
      <p className="mb-4 text-xs text-slate-600">{fr.stock.calculatedNote}</p>

      {canWrite && (
        <div className="mb-6">
          <Card title={fr.stock.newMovement}>
            <ActionForm
              action={addMovementAction}
              submitLabel={fr.stock.addMovement}
            >
              <input type="hidden" name="stockItemId" value={item.id} />
              <div className="grid gap-3 md:grid-cols-3">
                <SelectField
                  id="type"
                  label={fr.stock.movementType}
                  options={Object.entries(fr.stock.types).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
                <TextInput
                  id="quantity"
                  label={fr.stock.movementQuantity}
                  type="number"
                  step={1}
                  required
                  help={fr.stock.movementQuantityHelp}
                />
                <TextInput
                  id="reason"
                  label={fr.stock.reason}
                  required
                  maxLength={200}
                  help={fr.stock.reasonHelp}
                />
              </div>
            </ActionForm>
          </Card>
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">{fr.stock.movements}</h2>
      <DataTable caption={fr.stock.movements}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.stock.date}
            </th>
            <th className={th} scope="col">
              {fr.stock.movementType}
            </th>
            <th className={th} scope="col">
              {fr.stock.movementQuantity}
            </th>
            <th className={th} scope="col">
              {fr.stock.reason}
            </th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 && <EmptyRow colSpan={4} />}
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td className={td}>{dateFormat.format(movement.createdAt)}</td>
              <td className={td}>{fr.stock.types[movement.type]}</td>
              <td className={td}>
                {movement.type === "OUT"
                  ? "−"
                  : movement.type === "ADJUSTMENT" && movement.quantity > 0
                    ? "+"
                    : ""}
                {movement.quantity}
              </td>
              <td className={td}>{movement.reason}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
