import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  anonymizePersonAction,
  departPersonAction,
  updatePersonAction,
} from "../actions";
import PersonFormFields from "@/components/PersonForm";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { secondaryLink } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.people.editTitle} — ${fr.app.name}`,
};

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, repos } = await getAppContext();
  if (!can(session.role, "people:write")) redirect("/collaborateurs");
  const [person, teams] = await Promise.all([
    repos.people.getById(id),
    repos.teams.list(),
  ]);
  if (!person) notFound();
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.people.editTitle}</h1>
      <ActionForm action={updatePersonAction}>
        <input type="hidden" name="id" value={person.id} />
        <PersonFormFields teams={teams} defaults={person} />
      </ActionForm>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <Link href="/collaborateurs" className={secondaryLink}>
          {fr.common.back}
        </Link>
        {person.zoneKey && (
          <Link
            href={`/carte?zone=${person.zoneKey}`}
            className={secondaryLink}
          >
            {fr.common.viewOnMap}
          </Link>
        )}
        {person.status !== "DEPARTED" && (
          <ConfirmDialog
            triggerLabel={fr.people.depart}
            title={fr.people.departTitle}
            description={fr.people.departBody}
            action={departPersonAction}
          >
            <input type="hidden" name="id" value={person.id} />
          </ConfirmDialog>
        )}
        {person.status === "DEPARTED" &&
          !person.anonymized &&
          can(session.role, "privacy:manageRequests") && (
            <ConfirmDialog
              triggerLabel={fr.people.anonymize}
              title={fr.people.anonymizeTitle}
              description={fr.people.anonymizeBody}
              action={anonymizePersonAction}
            >
              <input type="hidden" name="id" value={person.id} />
            </ConfirmDialog>
          )}
      </div>
    </div>
  );
}
