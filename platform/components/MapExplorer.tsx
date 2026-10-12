"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { generateMockData, getPersonMarkers } from "@/features/map/mockData";
import type { Role } from "@/features/map/types";
import { fr } from "@/lib/i18n/fr";
import { generateLayout } from "@/lib/map/generator";
import { logoutAction } from "@/app/login/actions";
import ZonePanel from "./ZonePanel";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <p className="flex h-full items-center justify-center bg-slate-800 text-slate-200">
      {fr.map.loading}
    </p>
  ),
});

const DEFAULT_SEED = 2024;

function parseSeed(value: string | null): number {
  const seed = Number(value);
  return value !== null &&
    Number.isInteger(seed) &&
    seed >= 0 &&
    seed <= 4294967295
    ? seed
    : DEFAULT_SEED;
}

function MapWorkspace({
  seed,
  role,
  organizationName,
}: {
  seed: number;
  role: Role;
  organizationName: string;
}) {
  const router = useRouter();
  const layout = useMemo(() => generateLayout(seed), [seed]);
  const data = useMemo(() => generateMockData(layout), [layout]);
  const people = useMemo(() => getPersonMarkers(data), [data]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const selectedZone =
    layout.zones.find((zone) => zone.id === selectedZoneId) ?? null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2">
        <h1 className="text-lg font-semibold">{fr.map.pageTitle}</h1>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
          {fr.map.demoNotice}
        </span>
        <span className="text-sm text-slate-600">
          {fr.map.seedLabel} : <output data-testid="seed">{seed}</output>
        </span>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/carte?seed=${Math.floor(Math.random() * 1_000_000_000)}`,
            )
          }
          className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          {fr.map.newLayout}
        </button>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span>
            {organizationName} ·{" "}
            <span data-testid="role">{fr.map.roles[role]}</span>
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600"
            >
              {fr.auth.logout}
            </button>
          </form>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="min-h-[50vh] flex-1">
          <MapView
            layout={layout}
            people={people}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
          />
        </main>
        <aside
          aria-label={selectedZone ? selectedZone.name : fr.map.zoneList}
          className="max-h-[45vh] overflow-y-auto border-t border-slate-200 p-4 lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l"
        >
          <ZonePanel
            layout={layout}
            data={data}
            zone={selectedZone}
            role={role}
            onSelectZone={setSelectedZoneId}
          />
        </aside>
      </div>
    </div>
  );
}

export default function MapExplorer({
  role,
  organizationName,
}: {
  role: Role;
  organizationName: string;
}) {
  const seed = parseSeed(useSearchParams().get("seed"));
  return (
    <MapWorkspace
      key={seed}
      seed={seed}
      role={role}
      organizationName={organizationName}
    />
  );
}
