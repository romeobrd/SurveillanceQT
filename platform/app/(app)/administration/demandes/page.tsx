import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminTabs from "../AdminTabs";
import { executeErasureAction, updateRequestStatusAction } from "../actions";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Badge,
  DataTable,
  EmptyRow,
  FilterForm,
  FilterSelect,
  td,
  th,
} from "@/components/ui/layout";
import { PrivacyRequestQuerySchema } from "@/features/privacy/schemas";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.admin.requestsTitle} — ${fr.app.name}`,
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "privacy:manageRequests"))
    redirect("/tableau-de-bord");
  const query = PrivacyRequestQuerySchema.parse(await searchParams);
  const requests = await repos.privacy.listRequests(query);
  const t = fr.privacy;
  const next = [
    ["IN_PROGRESS", fr.admin.markInProgress],
    ["DONE", fr.admin.markDone],
    ["REJECTED", fr.admin.markRejected],
  ] as const;
  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.admin.title}</h1>
      <AdminTabs current="/administration/demandes" />
      <FilterForm action="/administration/demandes">
        <FilterSelect
          id="status"
          label={fr.admin.status}
          value={query.status}
          options={[
            { value: "", label: fr.admin.allStatuses },
            ...Object.entries(t.statuses).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </FilterForm>
      <DataTable caption={fr.admin.requestsTitle}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.admin.requester}
            </th>
            <th className={th} scope="col">
              {fr.admin.type}
            </th>
            <th className={th} scope="col">
              {fr.admin.status}
            </th>
            <th className={th} scope="col">
              {fr.admin.details}
            </th>
            <th className={th} scope="col">
              {t.createdOn}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && <EmptyRow colSpan={6} />}
          {requests.map((request) => {
            const open =
              request.status === "OPEN" || request.status === "IN_PROGRESS";
            return (
              <tr key={request.id}>
                <td className={td}>{request.requesterName}</td>
                <td className={td}>{t.types[request.type]}</td>
                <td className={td}>
                  <Badge tone={request.status === "DONE" ? "ok" : "neutral"}>
                    {t.statuses[request.status]}
                  </Badge>
                </td>
                <td className={`${td} max-w-xs break-words`}>
                  {request.details || "—"}
                </td>
                <td className={td}>{dateFormat.format(request.createdAt)}</td>
                <td className={td}>
                  {open && (
                    <div className="flex flex-wrap items-end gap-2">
                      {next
                        .filter(
                          ([status]) =>
                            !(
                              status === "IN_PROGRESS" &&
                              request.status === "IN_PROGRESS"
                            ),
                        )
                        .map(([status, label]) => (
                          <ActionForm
                            key={status}
                            action={updateRequestStatusAction}
                            submitLabel={label}
                            variant="secondary"
                            className="flex flex-col gap-1"
                          >
                            <input type="hidden" name="id" value={request.id} />
                            <input type="hidden" name="status" value={status} />
                          </ActionForm>
                        ))}
                      {request.type === "ERASURE" && (
                        <ConfirmDialog
                          triggerLabel={fr.admin.executeErasure}
                          title={fr.admin.executeTitle}
                          description={fr.admin.executeBody}
                          action={executeErasureAction}
                        >
                          <input type="hidden" name="id" value={request.id} />
                        </ConfirmDialog>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}
