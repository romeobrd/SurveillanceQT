"use client";

import { useState } from "react";
import { fr } from "@/lib/i18n/fr";
import {
  createEmptyLayout,
  MAX_EMPTY_SIZE,
  MIN_EMPTY_SIZE,
} from "@/lib/map/edit";
import { generateLayout } from "@/lib/map/generator";
import type { Layout } from "@/lib/map/schema";
import { TextInput } from "@/components/ui/fields";

const button =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600";

/** Point de départ : carte enregistrée, carte générée ou locaux vides. Remplace le brouillon (annulable). */
export default function StartPanel({
  savedLayout,
  onLoad,
}: {
  savedLayout: Layout | null;
  onLoad: (layout: Layout) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">{fr.editor.start.title}</h2>

      <section
        aria-labelledby="start-saved"
        className="rounded-lg border border-slate-200 p-3"
      >
        <h3 id="start-saved" className="font-medium">
          {fr.editor.start.saved}
        </h3>
        <p className="mb-2 text-xs text-slate-600">
          {savedLayout ? fr.editor.start.savedHelp : fr.editor.start.none}
        </p>
        <button
          type="button"
          disabled={!savedLayout}
          onClick={() => savedLayout && onLoad(savedLayout)}
          className={`${button} disabled:opacity-50`}
        >
          {fr.editor.start.saved}
        </button>
      </section>

      <form
        aria-labelledby="start-generated"
        className="rounded-lg border border-slate-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const seed = Number(new FormData(event.currentTarget).get("seed"));
          if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295)
            return setError(fr.errors.invalid);
          setError(null);
          onLoad(generateLayout(seed));
        }}
      >
        <h3 id="start-generated" className="mb-2 font-medium">
          {fr.editor.start.generated}
        </h3>
        <TextInput
          id="seed"
          label={fr.editor.start.seed}
          type="number"
          min={0}
          step={1}
          defaultValue={2024}
          required
        />
        <button type="submit" className={`${button} mt-2`}>
          {fr.editor.start.generate}
        </button>
      </form>

      <form
        aria-labelledby="start-empty"
        className="rounded-lg border border-slate-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            setError(null);
            onLoad(
              createEmptyLayout(
                Number(data.get("width")),
                Number(data.get("height")),
              ),
            );
          } catch {
            setError(`${fr.errors.invalid} (${fr.editor.start.sizeRange})`);
          }
        }}
      >
        <h3 id="start-empty" className="font-medium">
          {fr.editor.start.empty}
        </h3>
        <p className="mb-2 text-xs text-slate-600">
          {fr.editor.start.emptyHelp} {fr.editor.start.sizeRange}.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            id="width"
            label={fr.editor.start.width}
            type="number"
            min={MIN_EMPTY_SIZE}
            max={MAX_EMPTY_SIZE}
            step={1}
            defaultValue={24}
            required
          />
          <TextInput
            id="height"
            label={fr.editor.start.height}
            type="number"
            min={MIN_EMPTY_SIZE}
            max={MAX_EMPTY_SIZE}
            step={1}
            defaultValue={20}
            required
          />
        </div>
        <button type="submit" className={`${button} mt-2`}>
          {fr.editor.start.create}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  );
}
