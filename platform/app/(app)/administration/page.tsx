import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminTabs from "./AdminTabs";
import { updateSettingsAction } from "./actions";
import ActionForm from "@/components/ui/ActionForm";
import { TextInput } from "@/components/ui/fields";
import { Card } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";
import { RETENTION } from "@/lib/privacy/retention";

export const metadata: Metadata = {
  title: `${fr.admin.title} — ${fr.app.name}`,
};

const bounds = (key: keyof typeof RETENTION) =>
  fr.admin.retentionHelp
    .replace("{min}", String(RETENTION[key].min))
    .replace("{max}", String(RETENTION[key].max));

export default async function AdministrationPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "org:settings")) redirect("/tableau-de-bord");
  const settings = await repos.settings.get();
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.admin.title}</h1>
      <AdminTabs current="/administration" />
      <Card title={fr.admin.settingsTitle}>
        <ActionForm action={updateSettingsAction}>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="presenceEnabled"
                defaultChecked={settings.presenceEnabled}
              />
              {fr.admin.presenceEnabled}
            </label>
            <p className="text-xs text-slate-600">{fr.admin.presenceHelp}</p>
          </div>
          {(
            [
              ["auditRetentionDays", fr.admin.auditRetention],
              ["privacyRequestRetentionDays", fr.admin.requestRetention],
              ["departedPersonRetentionDays", fr.admin.departedRetention],
            ] as const
          ).map(([key, label]) => (
            <TextInput
              key={key}
              id={key}
              label={label}
              help={bounds(key)}
              type="number"
              required
              min={RETENTION[key].min}
              max={RETENTION[key].max}
              defaultValue={settings[key]}
            />
          ))}
        </ActionForm>
      </Card>
    </div>
  );
}
