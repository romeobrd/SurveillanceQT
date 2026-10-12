import type { Metadata } from "next";
import {
  clearPresenceAction,
  createPrivacyRequestAction,
  setPresenceAction,
} from "./actions";
import ActionForm from "@/components/ui/ActionForm";
import { SelectField, TextArea } from "@/components/ui/fields";
import {
  Badge,
  Card,
  DataTable,
  EmptyRow,
  primaryLink,
  td,
  th,
} from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.privacy.title} — ${fr.app.name}`,
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function MyDataPage() {
  const { repos } = await getAppContext();
  const [data, requests, presence] = await Promise.all([
    repos.privacy.getMyData(),
    repos.privacy.listMyRequests(),
    repos.presence.getMine(),
  ]);
  const t = fr.privacy;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-sm text-slate-700">{t.intro}</p>

      {!data ? (
        <p role="status">{t.noPerson}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={t.identity}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-medium">{fr.people.firstName}</dt>
              <dd>{data.person?.firstName}</dd>
              <dt className="font-medium">{fr.people.lastName}</dt>
              <dd>{data.person?.lastName}</dd>
              <dt className="font-medium">{fr.people.workEmail}</dt>
              <dd>{data.person?.workEmail}</dd>
              <dt className="font-medium">{fr.people.jobTitle}</dt>
              <dd>{data.person?.jobTitle}</dd>
              <dt className="font-medium">{t.team}</dt>
              <dd>{data.person?.team?.name ?? fr.common.noTeam}</dd>
            </dl>
          </Card>
          <Card title={t.account}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-medium">{fr.auth.email}</dt>
              <dd>{data.account?.email}</dd>
            </dl>
          </Card>
          <Card title={t.workstations}>
            {data.workstations.length === 0 ? (
              <p className="text-sm text-slate-600">{t.noneWorkstation}</p>
            ) : (
              <ul className="text-sm">
                {data.workstations.map((station) => (
                  <li key={station.elementKey}>
                    {station.elementKey} — {station.zone.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t.assets}>
            {data.assets.length === 0 ? (
              <p className="text-sm text-slate-600">{t.noneAssets}</p>
            ) : (
              <ul className="text-sm">
                {data.assets.map((asset) => (
                  <li key={asset.serialNumber}>
                    {asset.type} {asset.brand} {asset.model}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {data && (
        <p className="flex flex-wrap items-center gap-3">
          {/* Téléchargement direct : le navigateur enregistre le fichier, aucun script nécessaire */}
          <a href="/mes-donnees/export" download className={primaryLink}>
            {t.export}
          </a>
          <span className="text-sm text-slate-600">{t.exportHelp}</span>
        </p>
      )}

      <Card title={t.presenceTitle}>
        {!presence.enabled ? (
          <p className="text-sm text-slate-600">{t.presenceDisabled}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">{t.presenceHelp}</p>
            <p className="text-sm" data-testid="presence-current">
              {t.presenceCurrent}{" "}
              <strong>
                {presence.status
                  ? t.presenceKinds[presence.status]
                  : t.presenceNone}
              </strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {(["OFFICE", "REMOTE", "ABSENT"] as const).map((kind) => (
                <ActionForm
                  key={kind}
                  action={setPresenceAction}
                  submitLabel={t.presenceKinds[kind]}
                  variant="secondary"
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="status" value={kind} />
                </ActionForm>
              ))}
              {presence.status && (
                <ActionForm
                  action={clearPresenceAction}
                  submitLabel={t.presenceClear}
                  variant="secondary"
                  className="flex flex-col gap-2"
                >
                  <span className="hidden" />
                </ActionForm>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title={t.requestsTitle}>
        <ActionForm
          action={createPrivacyRequestAction}
          submitLabel={t.requestSubmit}
        >
          <SelectField
            id="type"
            label={t.requestType}
            options={Object.entries(t.types).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <TextArea id="details" label={t.requestDetails} maxLength={500} />
        </ActionForm>
      </Card>

      <DataTable caption={t.myRequests}>
        <thead>
          <tr>
            <th className={th} scope="col">
              {fr.admin.type}
            </th>
            <th className={th} scope="col">
              {fr.admin.status}
            </th>
            <th className={th} scope="col">
              {t.createdOn}
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && <EmptyRow colSpan={3} />}
          {requests.map((request) => (
            <tr key={request.id}>
              <td className={td}>{t.types[request.type]}</td>
              <td className={td}>
                <Badge tone={request.status === "DONE" ? "ok" : "neutral"}>
                  {t.statuses[request.status]}
                </Badge>
              </td>
              <td className={td}>{dateFormat.format(request.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
