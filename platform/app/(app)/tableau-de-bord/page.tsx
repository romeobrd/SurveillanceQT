import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  Card,
  ProgressBar,
  secondaryLink,
} from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.dashboard.title} — ${fr.app.name}`,
};

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "alert";
}) {
  const body = (
    <>
      <span
        className={`block text-3xl font-semibold ${tone === "alert" && value > 0 ? "text-red-700" : ""}`}
      >
        {value}
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </>
  );
  const className =
    "block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-600";
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function DashboardPage() {
  const { repos } = await getAppContext();
  const dashboard = await repos.dashboard.get();
  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.dashboard.title}</h1>
      <section
        aria-label={fr.dashboard.title}
        className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
      >
        <Stat
          label={fr.dashboard.activePeople}
          value={dashboard.activePeople}
          href="/collaborateurs"
        />
        <Stat
          label={fr.dashboard.workstationsOccupied}
          value={dashboard.workstations.occupied}
          href="/postes?status=occupied"
        />
        <Stat
          label={fr.dashboard.workstationsFree}
          value={dashboard.workstations.free}
          href="/postes?status=free"
        />
        <Stat
          label={fr.dashboard.stockAlerts}
          value={dashboard.lowStock.length}
          href="/stock?alert=low"
          tone="alert"
        />
        <Stat
          label={fr.dashboard.assetsBroken}
          value={dashboard.assets.broken}
          href="/materiel?state=BROKEN"
          tone="alert"
        />
        <Stat
          label={fr.dashboard.assetsToRenew}
          value={dashboard.assets.toRenew}
          href="/materiel?state=TO_RENEW"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={fr.dashboard.lowStock}>
          {dashboard.lowStock.length === 0 ? (
            <p className="text-sm text-slate-600">{fr.dashboard.noAlerts}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {dashboard.lowStock.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <Link
                    href={`/stock/${item.id}`}
                    className="font-medium underline"
                  >
                    {item.name}
                  </Link>
                  <span className="flex items-center gap-2">
                    <Badge tone="alert">
                      <span aria-hidden="true">⚠ </span>
                      {item.quantity} / {item.threshold} {item.unit}
                    </Badge>
                    {item.zoneKey && (
                      <Link
                        href={`/carte?zone=${item.zoneKey}`}
                        className="text-orange-800 underline"
                      >
                        {fr.common.viewOnMap}
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={fr.dashboard.assetProblems}>
          {dashboard.assets.problems.length === 0 ? (
            <p className="text-sm text-slate-600">{fr.dashboard.noAlerts}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {dashboard.assets.problems.map((asset) => (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <Link
                    href={`/materiel/${asset.id}`}
                    className="font-medium underline"
                  >
                    {asset.label}
                  </Link>
                  <Badge tone={asset.state === "BROKEN" ? "alert" : "warn"}>
                    {fr.assets.states[asset.state]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {dashboard.presence && (
          <div className="lg:col-span-2">
            <Card title={fr.dashboard.presenceTitle}>
              <ul
                className="flex flex-wrap gap-6 text-sm"
                data-testid="presence-totals"
              >
                <li>
                  <strong className="text-2xl">
                    {dashboard.presence.office}
                  </strong>{" "}
                  {fr.dashboard.presenceOffice}
                </li>
                <li>
                  <strong className="text-2xl">
                    {dashboard.presence.remote}
                  </strong>{" "}
                  {fr.dashboard.presenceRemote}
                </li>
                <li>
                  <strong className="text-2xl">
                    {dashboard.presence.absent}
                  </strong>{" "}
                  {fr.dashboard.presenceAbsent}
                </li>
              </ul>
              <p className="mt-2 text-xs text-slate-600">
                {fr.dashboard.presenceNote}
              </p>
            </Card>
          </div>
        )}

        <div className="lg:col-span-2">
          <Card title={fr.dashboard.projects}>
            {dashboard.projects.length === 0 ? (
              <p className="text-sm text-slate-600">
                {fr.dashboard.noProjects}
              </p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {dashboard.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <Link
                      href={`/projets/${project.id}`}
                      className="font-medium underline"
                    >
                      {project.name}
                    </Link>
                    <span className="flex items-center gap-3">
                      <ProgressBar
                        value={project.progress}
                        label={`${project.name} : ${project.progress} %`}
                      />
                      <Link
                        href={`/carte?project=${project.id}`}
                        className={secondaryLink}
                      >
                        {fr.projects.openOnMap}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
