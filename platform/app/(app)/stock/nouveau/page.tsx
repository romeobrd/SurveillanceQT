import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createStockItemAction } from "../actions";
import StockItemFields from "@/components/StockItemForm";
import ActionForm from "@/components/ui/ActionForm";
import { secondaryLink } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: `${fr.stock.new} — ${fr.app.name}` };

export default async function NewStockItemPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "stock:write")) redirect("/stock");
  const zones = await repos.zones.list();
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.stock.new}</h1>
      <ActionForm action={createStockItemAction} submitLabel={fr.common.create}>
        <StockItemFields zones={zones} />
      </ActionForm>
      <p className="mt-4">
        <Link href="/stock" className={secondaryLink}>
          {fr.common.back}
        </Link>
      </p>
    </div>
  );
}
