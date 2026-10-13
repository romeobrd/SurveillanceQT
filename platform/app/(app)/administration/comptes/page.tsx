import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminTabs from "../AdminTabs";
import {
  createAccountAction,
  resetPasswordAction,
  setDisabledAction,
  setRoleAction,
} from "./actions";
import TemporaryPasswordForm from "@/components/admin/TemporaryPasswordForm";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SelectField, TextInput } from "@/components/ui/fields";
import {
  Badge,
  Card,
  DataTable,
  EmptyRow,
  td,
  th,
} from "@/components/ui/layout";
import { ROLES } from "@/features/accounts/schemas";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.accounts.title} — ${fr.app.name}`,
};

const t = fr.accounts;
const roleOptions = ROLES.map((role) => ({
  value: role,
  label: t.roles[role],
}));

export default async function AccountsPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "users:manage")) redirect("/tableau-de-bord");
  const [accounts, linkable] = await Promise.all([
    repos.accounts.list(),
    repos.accounts.linkablePeople(),
  ]);
  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.admin.title}</h1>
      <AdminTabs current="/administration/comptes" />
      <p className="mb-4 max-w-3xl text-sm text-slate-700">{t.intro}</p>

      <DataTable caption={t.title}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {t.email}
            </th>
            <th className={th} scope="col">
              {t.person}
            </th>
            <th className={th} scope="col">
              {t.role}
            </th>
            <th className={th} scope="col">
              {t.status}
            </th>
            <th className={th} scope="col">
              {fr.common.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && <EmptyRow colSpan={5} />}
          {accounts.map((account) => {
            const self = account.id === session.userId;
            return (
              <tr key={account.id}>
                <td className={td}>
                  {account.email}{" "}
                  {self && <span className="text-slate-500">{t.you}</span>}
                </td>
                <td className={td}>{account.person?.name ?? t.noPerson}</td>
                <td className={td}>
                  {self ? (
                    t.roles[account.role]
                  ) : (
                    <ActionForm
                      action={setRoleAction}
                      submitLabel={t.changeRole}
                      variant="secondary"
                      className="flex items-end gap-2"
                    >
                      <input type="hidden" name="id" value={account.id} />
                      <SelectField
                        id="role"
                        label={t.role}
                        options={roleOptions}
                        defaultValue={account.role}
                      />
                    </ActionForm>
                  )}
                </td>
                <td className={td}>
                  <Badge tone={account.disabled ? "neutral" : "ok"}>
                    {account.disabled ? t.disabled : t.active}
                  </Badge>
                  {account.invitationPending && !account.disabled && (
                    <>
                      {" "}
                      <Badge tone="warn">{t.pendingInvite}</Badge>
                    </>
                  )}
                  {account.mustChangePassword && !account.disabled && (
                    <>
                      {" "}
                      <Badge tone="warn">{t.pending}</Badge>
                    </>
                  )}
                </td>
                <td className={td}>
                  {!self && (
                    <div className="flex flex-wrap items-start gap-2">
                      {account.disabled ? (
                        <ActionForm
                          action={setDisabledAction}
                          submitLabel={t.enable}
                          variant="secondary"
                          className="flex flex-col gap-1"
                        >
                          <input type="hidden" name="id" value={account.id} />
                          <input type="hidden" name="disabled" value="false" />
                        </ActionForm>
                      ) : (
                        <>
                          <TemporaryPasswordForm
                            action={resetPasswordAction}
                            submitLabel={t.resetPassword}
                            variant="secondary"
                            className="flex flex-col gap-1"
                          >
                            <input type="hidden" name="id" value={account.id} />
                            <input
                              type="hidden"
                              name="email"
                              value={account.email}
                            />
                          </TemporaryPasswordForm>
                          <ConfirmDialog
                            triggerLabel={t.disable}
                            title={t.disableTitle}
                            description={t.disableBody}
                            action={setDisabledAction}
                          >
                            <input type="hidden" name="id" value={account.id} />
                            <input type="hidden" name="disabled" value="true" />
                          </ConfirmDialog>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      <div className="mt-6 max-w-xl">
        <Card title={t.newAccount}>
          <TemporaryPasswordForm
            action={createAccountAction}
            submitLabel={t.create}
          >
            <TextInput
              id="email"
              label={t.email}
              type="email"
              required
              maxLength={200}
            />
            <SelectField
              id="role"
              label={t.role}
              options={roleOptions}
              defaultValue="EMPLOYEE"
            />
            <SelectField
              id="personId"
              label={t.person}
              placeholder={t.noPerson}
              options={linkable.map((person) => ({
                value: person.id,
                label: person.name,
              }))}
            />
          </TemporaryPasswordForm>
        </Card>
      </div>
    </div>
  );
}
