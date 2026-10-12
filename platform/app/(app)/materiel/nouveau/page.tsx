import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAssetAction } from "../actions";
import AssetFields from "@/components/AssetForm";
import ActionForm from "@/components/ui/ActionForm";
import { secondaryLink } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.assets.new} — ${fr.app.name}`,
};

export default async function NewAssetPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "asset:write")) redirect("/materiel");
  const [people, zones] = await Promise.all([
    repos.people.list({ status: "ACTIVE" }),
    repos.zones.list(),
  ]);
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.assets.new}</h1>
      <ActionForm action={createAssetAction} submitLabel={fr.common.create}>
        <AssetFields people={people} zones={zones} />
      </ActionForm>
      <p className="mt-4">
        <Link href="/materiel" className={secondaryLink}>
          {fr.common.back}
        </Link>
      </p>
    </div>
  );
}
