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
import { PeopleQuerySchema } from "@/features/people/schemas";
import { firstValues } from "@/features/list-query";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.people.title} — ${fr.app.name}`,
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = PeopleQuerySchema.parse(firstValues(await searchParams));
  const { session, repos } = await getAppContext();
  const [people, teams] = await Promise.all([
    repos.people.list(query),
    repos.teams.list(),
  ]);
  const canWrite = can(session.role, "people:write");
  const seesDetails = can(session.role, "people:readDetails");

  return (
    <div className="mx-auto max-w-6xl p-4">
      <PageHeader title={fr.people.title}>
        {canWrite && (
          <>
            <Link href="/collaborateurs/equipes" className={secondaryLink}>
              {fr.people.manageTeams}
            </Link>
            <Link href="/collaborateurs/nouveau" className={primaryLink}>
              {fr.people.new}
            </Link>
          </>
        )}
      </PageHeader>

      <FilterForm action="/collaborateurs">
        <FilterInput
          id="search"
          label={fr.common.search}
          defaultValue={query.search}
        />
        <FilterSelect
          id="teamId"
          label={fr.people.team}
          value={query.teamId}
          options={[
            { value: "", label: fr.common.all },
            ...teams.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
        {seesDetails && (
          <FilterSelect
            id="status"
            label={fr.people.statusFilter}
            value={query.status}
            options={[
              { value: "ACTIVE", label: fr.people.active },
              { value: "DEPARTED", label: fr.people.departed },
              { value: "ALL", label: fr.people.allStatuses },
            ]}
          />
        )}
        <FilterSelect
          id="sort"
          label={fr.common.sortBy}
          value={query.sort}
          options={Object.entries(fr.people.sortOptions).map(
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

      <DataTable caption={fr.people.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.people.lastName}
            </th>
            <th className={th} scope="col">
              {fr.people.firstName}
            </th>
            <th className={th} scope="col">
              {fr.people.jobTitle}
            </th>
            <th className={th} scope="col">
              {fr.people.team}
            </th>
            {seesDetails && (
              <th className={th} scope="col">
                {fr.people.workEmail}
              </th>
            )}
            {seesDetails && (
              <th className={th} scope="col">
                {fr.people.status}
              </th>
            )}
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {people.length === 0 && <EmptyRow colSpan={seesDetails ? 7 : 5} />}
          {people.map((person) => (
            <tr key={person.id}>
              <td className={td}>{person.lastName}</td>
              <td className={td}>{person.firstName}</td>
              <td className={td}>{person.jobTitle}</td>
              <td className={td}>{person.teamName ?? fr.common.noTeam}</td>
              {seesDetails && <td className={td}>{person.workEmail}</td>}
              {seesDetails && (
                <td className={td}>
                  <Badge tone={person.status === "DEPARTED" ? "neutral" : "ok"}>
                    {person.status === "DEPARTED"
                      ? fr.people.departed
                      : fr.people.active}
                  </Badge>
                  {person.anonymized && (
                    <>
                      {" "}
                      <Badge tone="warn">{fr.people.anonymized}</Badge>
                    </>
                  )}
                </td>
              )}
              <td className={`${td} flex flex-wrap gap-2`}>
                {person.zoneKey && (
                  <Link
                    href={`/carte?zone=${person.zoneKey}`}
                    className="text-brand-800 underline"
                  >
                    {fr.common.viewOnMap}
                  </Link>
                )}
                {canWrite && (
                  <Link
                    href={`/collaborateurs/${person.id}`}
                    className="underline"
                  >
                    {fr.common.edit}
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
