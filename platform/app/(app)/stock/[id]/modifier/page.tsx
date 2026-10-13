import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateStockItemAction } from "../../actions";
import StockItemFields from "@/components/StockItemForm";
import ActionForm from "@/components/ui/ActionForm";
import { secondaryLink } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.stock.editTitle} — ${fr.app.name}`,
};

export default async function EditStockItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, repos } = await getAppContext();
  if (!can(session.role, "stock:write")) redirect(`/stock/${id}`);
  const [detail, zones] = await Promise.all([
    repos.stock.getItem(id),
    repos.zones.list(),
  ]);
  if (!detail) notFound();
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.stock.editTitle}</h1>
      <ActionForm action={updateStockItemAction}>
        <input type="hidden" name="id" value={detail.item.id} />
        <StockItemFields zones={zones} defaults={detail.item} />
      </ActionForm>
      <p className="mt-4">
        <Link href={`/stock/${id}`} className={secondaryLink}>
          {fr.common.cancel}
        </Link>
      </p>
    </div>
  );
}
