import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPersonAction } from "../actions";
import PersonFormFields from "@/components/PersonForm";
import ActionForm from "@/components/ui/ActionForm";
import { secondaryLink } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.people.new} — ${fr.app.name}`,
};

export default async function NewPersonPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "people:write")) redirect("/collaborateurs");
  const teams = await repos.teams.list();
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.people.new}</h1>
      <ActionForm action={createPersonAction} submitLabel={fr.common.create}>
        <PersonFormFields teams={teams} />
      </ActionForm>
      <p className="mt-4">
        <Link href="/collaborateurs" className={secondaryLink}>
          {fr.common.back}
        </Link>
      </p>
    </div>
  );
}
