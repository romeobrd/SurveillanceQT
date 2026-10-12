import Link from "next/link";
import { useId } from "react";
import { fr } from "@/lib/i18n/fr";
import type { Layout, Zone } from "@/lib/map/schema";
import { ZONE_LABELS } from "@/lib/map/zoneTypes";
import type { MapData, Role } from "@/features/map/types";

interface ZonePanelProps {
  layout: Layout;
  data: MapData;
  zone: Zone | null;
  role: Role;
  /** Identifiant en base des zones de la carte (vide en aperçu) : liens vers les modules. */
  zoneDbIds: Record<string, string>;
  onSelectZone: (zoneId: string | null) => void;
}

const sectionTitle =
  "mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600";

function ZoneList({
  layout,
  onSelectZone,
}: Pick<ZonePanelProps, "layout" | "onSelectZone">) {
  const uid = useId();
  return (
    <section aria-labelledby={`${uid}-zone-list`}>
      <h2 id={`${uid}-zone-list`} className="text-lg font-semibold">
        {fr.map.zoneList}
      </h2>
      <p className="mb-3 text-sm text-slate-600">{fr.map.zoneListHint}</p>
      <ul className="flex flex-col gap-1">
        {layout.zones.map((zone) => (
          <li key={zone.id}>
            <button
              type="button"
              onClick={() => onSelectZone(zone.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded border border-slate-400"
                style={{ backgroundColor: zone.floorColor }}
              />
              <span>{zone.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ZonePanel({
  layout,
  data,
  zone,
  role,
  zoneDbIds,
  onSelectZone,
}: ZonePanelProps) {
  const uid = useId();
  if (!zone) return <ZoneList layout={layout} onSelectZone={onSelectZone} />;

  const workstations = data.workstations.filter((w) => w.zoneId === zone.id);
  const peopleById = new Map(data.people.map((p) => [p.id, p]));
  const occupiedCount = workstations.filter((w) => w.personId).length;
  const assets = data.assets.filter((a) => a.zoneId === zone.id);
  const stock = data.stock.filter((s) => s.zoneId === zone.id);
  const teams = [
    ...new Set(
      workstations.flatMap((w) => {
        const person = w.personId ? peopleById.get(w.personId) : undefined;
        return person ? [person.team] : [];
      }),
    ),
  ];
  const projects = data.projects.filter((p) => teams.includes(p.team));
  const canAct = role === "admin" || role === "manager";

  return (
    <article aria-labelledby={`${uid}-zone`} className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 id={`${uid}-zone`} className="text-xl font-semibold">
            {zone.name}
          </h2>
          <p className="text-sm text-slate-600">{ZONE_LABELS[zone.type]}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelectZone(null)}
          aria-label={fr.map.close}
          className="rounded-md px-2 py-1 text-xl leading-none hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-500"
        >
          ×
        </button>
      </header>

      <section aria-labelledby={`${uid}-ws`}>
        <h3 id={`${uid}-ws`} className={sectionTitle}>
          {fr.map.workstations} ({occupiedCount}/{workstations.length}{" "}
          {fr.map.occupied})
        </h3>
        {workstations.length === 0 ? (
          <p className="text-sm text-slate-600">{fr.map.none}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {workstations.map((w) => {
              const person = w.personId
                ? peopleById.get(w.personId)
                : undefined;
              return (
                <li key={w.elementId} className="flex justify-between gap-2">
                  <span className="text-slate-600">{w.label}</span>
                  <span className="text-right">
                    {person ? (
                      <>
                        {person.firstName} {person.lastName}
                        <span className="block text-xs text-slate-600">
                          {person.jobTitle}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-600">{fr.map.free}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {workstations.length > 0 && (
          <p className="mt-2 text-xs text-slate-600">
            {fr.map.assignmentNotice}
          </p>
        )}
      </section>

      <section aria-labelledby={`${uid}-assets`}>
        <h3 id={`${uid}-assets`} className={sectionTitle}>
          {fr.map.assets}
        </h3>
        {assets.length === 0 ? (
          <p className="text-sm text-slate-600">{fr.map.none}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {assets.map((asset) => (
              <li key={asset.id} className="flex justify-between gap-2">
                <span>{asset.label}</span>
                <span
                  className={
                    asset.state === "IN_SERVICE"
                      ? "text-slate-600"
                      : "font-medium text-red-700"
                  }
                >
                  {fr.map.assetStates[asset.state]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${uid}-stock`}>
        <h3 id={`${uid}-stock`} className={sectionTitle}>
          {fr.map.stock}
        </h3>
        {stock.length === 0 ? (
          <p className="text-sm text-slate-600">{fr.map.none}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {stock.map((item) => {
              const low = item.quantity < item.threshold;
              return (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>{item.name}</span>
                  <span
                    className={
                      low ? "font-medium text-red-700" : "text-slate-600"
                    }
                  >
                    {low && <span aria-hidden="true">⚠ </span>}
                    {item.quantity} {item.unit}
                    {low && (
                      <span className="sr-only"> — {fr.map.stockAlert}</span>
                    )}
                    {low && (
                      <span aria-hidden="true"> ({fr.map.stockAlert})</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${uid}-projects`}>
        <h3 id={`${uid}-projects`} className={sectionTitle}>
          {fr.map.projects}
        </h3>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-600">{fr.map.none}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {projects.map((project) => (
              <li key={project.id}>
                <div className="flex justify-between gap-2">
                  <span>{project.name}</span>
                  <span className="text-slate-600">{project.progress} %</span>
                </div>
                <progress
                  className="h-2 w-full"
                  value={project.progress}
                  max={100}
                  aria-label={`${project.name} : ${project.progress} %`}
                />
                <span className="text-xs text-slate-600">
                  {fr.map.teams} : {project.team}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canAct && zoneDbIds[zone.id] && (
        <section aria-labelledby={`${uid}-actions`}>
          <h3 id={`${uid}-actions`} className={sectionTitle}>
            {fr.map.quickActions}
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: fr.map.actions.assignWorkstation,
                href: `/postes?zoneId=${zoneDbIds[zone.id]}&status=free`,
              },
              {
                label: fr.map.actions.stockMovement,
                href: `/stock?zoneId=${zoneDbIds[zone.id]}`,
              },
              {
                label: fr.map.actions.reportIssue,
                href: `/materiel?zoneId=${zoneDbIds[zone.id]}`,
              },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
