"use client";

// Import CSV en deux étapes : analyse du fichier (aperçu des erreurs), puis import des lignes valides.
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  previewImportAction,
  runImportAction,
  type ImportActionState,
} from "@/app/(app)/import/actions";
import type { ImportKind } from "@/features/import/csv";
import { fr } from "@/lib/i18n/fr";

const t = fr.importCsv;
const MAX_REJECTED_SHOWN = 50;
const button =
  "focus-visible:outline-brand-600 rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

export default function ImportForm({ kind }: { kind: ImportKind }) {
  // Changer de clé remet le formulaire à zéro (« importer un autre fichier »)
  const [round, setRound] = useState(0);
  return (
    <ImportSteps
      key={round}
      kind={kind}
      onRestart={() => setRound((n) => n + 1)}
    />
  );
}

function ImportSteps({
  kind,
  onRestart,
}: {
  kind: ImportKind;
  onRestart: () => void;
}) {
  const [analysis, analyze, analyzing] = useActionState<
    ImportActionState,
    FormData
  >(previewImportAction, { error: null });
  const [outcome, runImport, importing] = useActionState<
    ImportActionState,
    FormData
  >(runImportAction, { error: null });
  const preview = analysis.preview;

  if (outcome.result)
    return (
      <div
        className="rounded-lg border border-green-200 bg-green-50 p-4"
        role="status"
      >
        <p
          className="mb-3 font-medium text-green-900"
          data-testid="import-done"
        >
          {t.done
            .replace("{created}", String(outcome.result.created))
            .replace("{skipped}", String(outcome.result.skipped))}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={t.back[kind]}
            className={`${button} bg-brand-600 hover:bg-brand-700 text-white`}
          >
            {fr.common.back}
          </Link>
          <button
            type="button"
            onClick={onRestart}
            className={`${button} border border-slate-300 bg-white text-slate-900 hover:bg-slate-100`}
          >
            {t.another}
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <form
        action={analyze}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="kind" value={kind} />
        <label htmlFor="import-file" className="text-sm font-medium">
          {t.file}
        </label>
        <input
          id="import-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          aria-describedby="import-limits"
          className="text-sm"
        />
        <p id="import-limits" className="text-xs text-slate-600">
          {t.limits}
        </p>
        {analysis.error && (
          <p
            role="alert"
            data-testid="form-error"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {analysis.error}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={analyzing}
            className={`${button} border border-slate-300 bg-white text-slate-900 hover:bg-slate-100`}
          >
            {analyzing ? t.analyzing : t.analyze}
          </button>
        </div>
      </form>

      {preview && (
        <section
          aria-labelledby="import-preview"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 id="import-preview" className="mb-2 text-lg font-semibold">
            {t.previewTitle}
          </h2>
          {preview.fileErrors.length > 0 ? (
            <ul role="alert" className="list-disc pl-5 text-sm text-red-800">
              {preview.fileErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : (
            <>
              <p className="mb-3 text-sm" data-testid="import-summary">
                {t.summary
                  .replace("{valid}", String(preview.valid))
                  .replace("{total}", String(preview.total))}
              </p>
              {preview.rejected.length > 0 && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="mb-1 text-left font-medium">
                      {t.rejectedTitle}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="bg-slate-100 px-3 py-2">
                          {t.line}
                        </th>
                        <th scope="col" className="bg-slate-100 px-3 py-2">
                          {t.problems}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rejected
                        .slice(0, MAX_REJECTED_SHOWN)
                        .map((row) => (
                          <tr key={row.line}>
                            <td className="border-t border-slate-200 px-3 py-2 tabular-nums">
                              {row.line}
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2">
                              {row.errors.join(" ; ")}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {preview.rejected.length > MAX_REJECTED_SHOWN && (
                    <p className="mt-1 text-xs text-slate-600">
                      {t.moreRejected.replace(
                        "{count}",
                        String(preview.rejected.length - MAX_REJECTED_SHOWN),
                      )}
                    </p>
                  )}
                </div>
              )}
              {preview.valid > 0 ? (
                <form action={runImport}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="csv" value={analysis.csv ?? ""} />
                  {outcome.error && (
                    <p
                      role="alert"
                      className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
                    >
                      {outcome.error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={importing}
                    className={`${button} bg-brand-600 hover:bg-brand-700 text-white`}
                  >
                    {importing
                      ? t.importing
                      : t.confirm.replace("{count}", String(preview.valid))}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-slate-700">{t.nothing}</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
