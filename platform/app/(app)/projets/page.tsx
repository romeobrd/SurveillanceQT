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
  ProgressBar,
  primaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { ProjectQuerySchema } from "@/features/projects/schemas";
import { firstValues } from "@/features/list-query";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.projects.title} — ${fr.app.name}`,
};

const tones = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warn",
  DONE: "ok",
} as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = ProjectQuerySchema.parse(firstValues(await searchParams));
  const { session, repos } = await getAppContext();
  const [projects, teams] = await Promise.all([
    repos.projects.list(query),
    repos.teams.list(),
  ]);
  const canWrite = can(session.role, "project:write");

  return (
    <div className="mx-auto max-w-6xl p-4">
      <PageHeader title={fr.projects.title}>
        {canWrite && (
          <Link href="/projets/nouveau" className={primaryLink}>
            {fr.projects.new}
          </Link>
        )}
      </PageHeader>
      <FilterForm action="/projets">
        <FilterInput
          id="search"
          label={fr.common.search}
          defaultValue={query.search}
        />
        <FilterSelect
          id="teamId"
          label={fr.projects.team}
          value={query.teamId}
          options={[
            { value: "", label: fr.common.all },
            ...teams.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
        <FilterSelect
          id="state"
          label={fr.projects.stateFilter}
          value={query.state}
          options={Object.entries(fr.projects.states).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </FilterForm>

      <DataTable caption={fr.projects.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.projects.name}
            </th>
            <th className={th} scope="col">
              {fr.projects.team}
            </th>
            <th className={th} scope="col">
              {fr.common.state}
            </th>
            <th className={th} scope="col">
              {fr.projects.progress}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 && <EmptyRow colSpan={5} />}
          {projects.map((project) => (
            <tr key={project.id}>
              <td className={td}>
                <Link
                  href={`/projets/${project.id}`}
                  className="font-medium underline"
                >
                  {project.name}
                </Link>
              </td>
              <td className={td}>{project.teamName ?? fr.common.noTeam}</td>
              <td className={td}>
                <Badge tone={tones[project.state]}>
                  {fr.projects.states[project.state]}
                </Badge>
              </td>
              <td className={td}>
                <ProgressBar
                  value={project.progress}
                  label={`${project.name} : ${project.progress} %`}
                />
              </td>
              <td className={td}>
                <Link
                  href={`/carte?project=${project.id}`}
                  className="text-orange-800 underline"
                >
                  {fr.projects.openOnMap}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
