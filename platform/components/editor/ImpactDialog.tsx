"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fr } from "@/lib/i18n/fr";
import {
  isPlanComplete,
  type LayoutImpact,
  type ReassignmentPlan,
} from "@/lib/map/edit/plan";
import { inputClass } from "@/components/ui/fields";

interface ImpactDialogProps {
  impact: LayoutImpact;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: (plan: ReassignmentPlan) => void;
  onCancel: () => void;
}

/**
 * Réaffectation sans perte (SPEC §6.4) : une décision explicite par poste attribué et par pièce utilisée.
 * Aucun choix par défaut : on ne peut pas confirmer tant que tout n'est pas décidé.
 */
export default function ImpactDialog({
  impact,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: ImpactDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [plan, setPlan] = useState<ReassignmentPlan>({
    workstations: {},
    zones: {},
  });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const usedStations = new Set(
    Object.values(plan.workstations).flatMap((choice) =>
      choice.action === "move" ? [choice.toElementKey] : [],
    ),
  );
  const complete = isPlanComplete(impact, plan);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg p-6 shadow-xl backdrop:bg-slate-900/50"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {fr.editor.impact.title}
      </h2>
      <p className="mt-1 text-sm text-slate-700">{fr.editor.impact.intro}</p>

      {impact.workstations.length > 0 && (
        <section className="mt-4" aria-label={fr.editor.impact.workstations}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-600 uppercase">
            {fr.editor.impact.workstations}
          </h3>
          <ul className="flex flex-col gap-3">
            {impact.workstations.map((item) => {
              const choice = plan.workstations[item.elementKey];
              const value = choice
                ? choice.action === "release"
                  ? "release"
                  : `move:${choice.toElementKey}`
                : "";
              return (
                <li
                  key={item.elementKey}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    <strong>{item.personName}</strong> — {item.label},{" "}
                    {item.zoneName}
                  </span>
                  <select
                    aria-label={`${item.personName} — ${item.label}`}
                    value={value}
                    onChange={(event) => {
                      const v = event.target.value;
                      setPlan((current) => {
                        const next = { ...current.workstations };
                        if (v === "") delete next[item.elementKey];
                        else if (v === "release")
                          next[item.elementKey] = { action: "release" };
                        else
                          next[item.elementKey] = {
                            action: "move",
                            toElementKey: v.slice(5),
                          };
                        return { ...current, workstations: next };
                      });
                    }}
                    className={`${inputClass} max-w-xs`}
                  >
                    <option value="">{fr.editor.impact.choose}</option>
                    <option value="release">{fr.editor.impact.release}</option>
                    {impact.targets.workstations
                      .filter(
                        (target) =>
                          !usedStations.has(target.elementKey) ||
                          value === `move:${target.elementKey}`,
                      )
                      .map((target) => (
                        <option
                          key={target.elementKey}
                          value={`move:${target.elementKey}`}
                        >
                          {fr.editor.impact.moveTo} {target.label},{" "}
                          {target.zoneName}
                        </option>
                      ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {impact.zones.length > 0 && (
        <section className="mt-4" aria-label={fr.editor.impact.zones}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-600 uppercase">
            {fr.editor.impact.zones}
          </h3>
          <ul className="flex flex-col gap-3">
            {impact.zones.map((item) => {
              const choice = plan.zones[item.zoneKey];
              const value = choice
                ? choice.action === "unassign"
                  ? "unassign"
                  : `move:${choice.toZoneKey}`
                : "";
              return (
                <li
                  key={item.zoneKey}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    <strong>{item.name}</strong> — {item.stockCount}{" "}
                    {fr.editor.impact.stockCount}, {item.assetCount}{" "}
                    {fr.editor.impact.assetCount}
                  </span>
                  <select
                    aria-label={item.name}
                    value={value}
                    onChange={(event) => {
                      const v = event.target.value;
                      setPlan((current) => {
                        const next = { ...current.zones };
                        if (v === "") delete next[item.zoneKey];
                        else if (v === "unassign")
                          next[item.zoneKey] = { action: "unassign" };
                        else
                          next[item.zoneKey] = {
                            action: "move",
                            toZoneKey: v.slice(5),
                          };
                        return { ...current, zones: next };
                      });
                    }}
                    className={`${inputClass} max-w-xs`}
                  >
                    <option value="">{fr.editor.impact.choose}</option>
                    <option value="unassign">
                      {fr.editor.impact.unassign}
                    </option>
                    {impact.targets.zones.map((target) => (
                      <option key={target.key} value={`move:${target.key}`}>
                        {fr.editor.impact.moveZoneTo} {target.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!complete && (
        <p className="mt-4 text-sm text-slate-600">
          {fr.editor.impact.incomplete}
        </p>
      )}
      {error && (
        <p
          role="alert"
          data-testid="impact-error"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!complete || busy}
          onClick={() => onConfirm(plan)}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50"
        >
          {busy ? fr.editor.saving : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600"
        >
          {fr.editor.impact.cancel}
        </button>
      </div>
    </dialog>
  );
}
