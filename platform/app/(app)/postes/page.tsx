import type { Metadata } from "next";
import Link from "next/link";
import { assignWorkstationAction } from "./actions";
import ActionForm from "@/components/ui/ActionForm";
import { inputClass } from "@/components/ui/fields";
import {
  Badge,
  DataTable,
  EmptyRow,
  FilterForm,
  FilterInput,
  FilterSelect,
  PageHeader,
  td,
  th,
} from "@/components/ui/layout";
import { WorkstationQuerySchema } from "@/features/people/schemas";
import { firstValues } from "@/features/list-query";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.workstations.title} — ${fr.app.name}`,
};

export default async function WorkstationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = WorkstationQuerySchema.parse(firstValues(await searchParams));
  const { session, repos } = await getAppContext();
  const canAssign = can(session.role, "workstation:assign");
  const [workstations, zones, people] = await Promise.all([
    repos.workstations.list(query),
    repos.zones.list(),
    canAssign
      ? repos.people.list({ status: "ACTIVE", sort: "lastName" })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <PageHeader title={fr.workstations.title} />
      <p className="mb-3 text-sm text-slate-600">
        {fr.workstations.assignmentNotice}
      </p>
      <FilterForm action="/postes">
        <FilterInput
          id="search"
          label={fr.common.search}
          defaultValue={query.search}
        />
        <FilterSelect
          id="zoneId"
          label={fr.common.zone}
          value={query.zoneId}
          options={[
            { value: "", label: fr.common.all },
            ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
          ]}
        />
        <FilterSelect
          id="status"
          label={fr.workstations.status}
          value={query.status}
          options={[
            { value: "all", label: fr.common.all },
            { value: "free", label: fr.workstations.free },
            { value: "occupied", label: fr.workstations.occupied },
          ]}
        />
      </FilterForm>

      <DataTable caption={fr.workstations.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.workstations.workstation}
            </th>
            <th className={th} scope="col">
              {fr.common.zone}
            </th>
            <th className={th} scope="col">
              {fr.workstations.occupant}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {workstations.length === 0 && <EmptyRow colSpan={4} />}
          {workstations.map((workstation) => (
            <tr key={workstation.id}>
              <td className={td}>{workstation.label}</td>
              <td className={td}>{workstation.zoneName}</td>
              <td className={td}>
                {workstation.personName ?? (
                  <Badge tone="ok">{fr.workstations.free}</Badge>
                )}
              </td>
              <td className={td}>
                <div className="flex flex-wrap items-end gap-3">
                  {canAssign && (
                    <ActionForm
                      action={assignWorkstationAction}
                      submitLabel={fr.workstations.assign}
                      variant="secondary"
                      className="flex items-end gap-2"
                    >
                      <input
                        type="hidden"
                        name="workstationId"
                        value={workstation.id}
                      />
                      <label
                        htmlFor={`person-${workstation.id}`}
                        className="sr-only"
                      >
                        {fr.workstations.choosePerson} — {workstation.label}
                      </label>
                      <select
                        id={`person-${workstation.id}`}
                        name="personId"
                        defaultValue={workstation.personId ?? ""}
                        className={inputClass}
                      >
                        <option value="">{fr.workstations.nobody}</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.lastName} {person.firstName}
                          </option>
                        ))}
                      </select>
                    </ActionForm>
                  )}
                  <Link
                    href={`/carte?zone=${workstation.zoneKey}`}
                    className="text-brand-800 underline"
                  >
                    {fr.common.viewOnMap}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
