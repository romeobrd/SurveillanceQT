import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createTeamAction,
  deleteTeamAction,
  renameTeamAction,
} from "../actions";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { TextInput } from "@/components/ui/fields";
import {
  Card,
  DataTable,
  EmptyRow,
  secondaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.people.teamsTitle} — ${fr.app.name}`,
};

export default async function TeamsPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "people:write")) redirect("/collaborateurs");
  const teams = await repos.teams.list();
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.people.teamsTitle}</h1>
      <DataTable caption={fr.people.teamsTitle}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.people.teamName}
            </th>
            <th className={th} scope="col">
              {fr.people.peopleCount}
            </th>
            <th className={th} scope="col">
              {fr.people.projectCount}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.length === 0 && <EmptyRow colSpan={4} />}
          {teams.map((team) => (
            <tr key={team.id}>
              <td className={td}>{team.name}</td>
              <td className={td}>{team.peopleCount}</td>
              <td className={td}>{team.projectCount}</td>
              <td className={td}>
                <div className="flex flex-wrap items-end gap-3">
                  <ActionForm
                    action={renameTeamAction}
                    submitLabel={fr.people.rename}
                    variant="secondary"
                    className="flex items-end gap-2"
                  >
                    <input type="hidden" name="id" value={team.id} />
                    <TextInput
                      id={`name-${team.id}`}
                      name="name"
                      label={fr.people.teamName}
                      defaultValue={team.name}
                      required
                      maxLength={80}
                    />
                  </ActionForm>
                  <ConfirmDialog
                    triggerLabel={fr.common.delete}
                    title={fr.people.deleteTeamTitle}
                    description={fr.people.deleteTeamBody}
                    action={deleteTeamAction}
                  >
                    <input type="hidden" name="id" value={team.id} />
                  </ConfirmDialog>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <div className="mt-6">
        <Card title={fr.people.newTeam}>
          <ActionForm action={createTeamAction} submitLabel={fr.common.create}>
            <TextInput
              id="name"
              label={fr.people.teamName}
              required
              maxLength={80}
            />
          </ActionForm>
        </Card>
      </div>
      <p className="mt-4">
        <Link href="/collaborateurs" className={secondaryLink}>
          {fr.common.back}
        </Link>
      </p>
    </div>
  );
}
