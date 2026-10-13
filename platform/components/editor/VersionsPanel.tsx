"use client";

import { useState, useTransition } from "react";
import {
  loadVersionAction,
  previewRestoreAction,
  restoreVersionAction,
} from "@/app/(app)/carte/actions";
import { fr } from "@/lib/i18n/fr";
import {
  isImpactEmpty,
  type LayoutImpact,
  type ReassignmentPlan,
} from "@/lib/map/edit/plan";
import type { Layout } from "@/lib/map/schema";
import ImpactDialog from "./ImpactDialog";

export interface VersionInfo {
  id: string;
  version: number;
  isActive: boolean;
  /** Date ISO (sérialisable). */
  createdAt: string;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const button =
  "rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50";

/** Historique (numéro et date seulement, jamais de nom d'auteur) : ouvrir une version ou la restaurer. */
export default function VersionsPanel({
  versions,
  onOpen,
  onRestored,
}: {
  versions: VersionInfo[];
  onOpen: (layout: Layout) => void;
  onRestored: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<{
    id: string;
    impact: LayoutImpact;
  } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function open(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await loadVersionAction(id);
      if (result.error || !result.layout)
        setError(result.error ?? fr.errors.generic);
      else onOpen(result.layout);
    });
  }

  function restore(id: string, plan: ReassignmentPlan | null) {
    setDialogError(null);
    startTransition(async () => {
      if (plan === null) {
        const preview = await previewRestoreAction(id);
        if (preview.error || !preview.impact)
          return setError(preview.error ?? fr.errors.generic);
        if (!isImpactEmpty(preview.impact))
          return setRestoring({ id, impact: preview.impact });
      }
      const result = await restoreVersionAction(id, plan ?? {});
      if (result.error) {
        setError(result.error);
        setDialogError(result.error);
        return;
      }
      setRestoring(null);
      onRestored();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{fr.editor.versions.title}</h2>
      <p className="text-xs text-slate-600">{fr.editor.versions.restoreHelp}</p>
      {versions.length === 0 ? (
        <p className="text-sm text-slate-600">{fr.editor.versions.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {versions.map((version) => (
            <li
              key={version.id}
              data-testid="version"
              className="rounded-lg border border-slate-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {fr.editor.versions.version} {version.version}
                </span>
                {version.isActive && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">
                    {fr.editor.versions.active}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {dateFormat.format(new Date(version.createdAt))}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => open(version.id)}
                  className={button}
                >
                  {fr.editor.versions.open}
                </button>
                {!version.isActive && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => restore(version.id, null)}
                    aria-label={`${fr.editor.versions.restore} ${fr.editor.versions.version} ${version.version}`}
                    className={button}
                  >
                    {fr.editor.versions.restore}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && !restoring && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {restoring && (
        <ImpactDialog
          impact={restoring.impact}
          confirmLabel={fr.editor.impact.restoreConfirm}
          busy={pending}
          error={dialogError}
          onConfirm={(plan) => restore(restoring.id, plan)}
          onCancel={() => setRestoring(null)}
        />
      )}
    </div>
  );
}
