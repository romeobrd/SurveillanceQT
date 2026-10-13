import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminTabs from "../AdminTabs";
import {
  DataTable,
  EmptyRow,
  FilterForm,
  FilterInput,
  FilterSelect,
  secondaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { AuditQuerySchema } from "@/features/privacy/schemas";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.admin.journalTitle} — ${fr.app.name}`,
};

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Paris",
});
const ROLE_LABELS: Record<string, string> = {
  ADMIN: fr.map.roles.admin,
  MANAGER: fr.map.roles.manager,
  EMPLOYEE: fr.map.roles.employe,
};
const isoDay = (date: Date | undefined) =>
  date ? date.toISOString().slice(0, 10) : "";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "audit:read")) redirect("/tableau-de-bord");
  const query = AuditQuerySchema.parse(await searchParams);
  const [result, actions] = await Promise.all([
    repos.audit.list(query),
    repos.audit.actions(),
  ]);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (query.from) params.set("from", isoDay(query.from));
    if (query.to) params.set("to", isoDay(query.to));
    if (query.action) params.set("action", query.action);
    params.set("page", String(page));
    return `/administration/journal?${params.toString()}`;
  };
  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.admin.title}</h1>
      <AdminTabs current="/administration/journal" />
      <p className="mb-3 text-sm text-slate-700">{fr.admin.auditNote}</p>
      <FilterForm action="/administration/journal">
        <FilterInput
          id="from"
          label={fr.admin.from}
          type="date"
          defaultValue={isoDay(query.from)}
        />
        <FilterInput
          id="to"
          label={fr.admin.to}
          type="date"
          defaultValue={isoDay(query.to)}
        />
        <FilterSelect
          id="action"
          label={fr.admin.action}
          value={query.action}
          options={[
            { value: "", label: fr.admin.allActions },
            ...actions.map((action) => ({ value: action, label: action })),
          ]}
        />
      </FilterForm>
      <DataTable caption={fr.admin.journalTitle}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.admin.date}
            </th>
            <th className={th} scope="col">
              {fr.admin.action}
            </th>
            <th className={th} scope="col">
              {fr.admin.resource}
            </th>
            <th className={th} scope="col">
              {fr.admin.actor}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 && <EmptyRow colSpan={4} />}
          {result.rows.map((row) => (
            <tr key={row.id}>
              <td className={td}>{dateTime.format(row.createdAt)}</td>
              <td className={td}>{row.action}</td>
              <td className={td}>
                {row.resourceType}
                {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}` : ""}
              </td>
              <td className={td}>
                {row.actorRole
                  ? `${ROLE_LABELS[row.actorRole] ?? row.actorRole} · ${row.actorRef}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span>
          {result.total} {fr.admin.entries} · {fr.admin.page} {result.page}{" "}
          {fr.admin.of} {result.pageCount}
        </span>
        {result.page > 1 && (
          <Link href={pageHref(result.page - 1)} className={secondaryLink}>
            {fr.admin.previous}
          </Link>
        )}
        {result.page < result.pageCount && (
          <Link href={pageHref(result.page + 1)} className={secondaryLink}>
            {fr.admin.next}
          </Link>
        )}
      </p>
    </div>
  );
}
