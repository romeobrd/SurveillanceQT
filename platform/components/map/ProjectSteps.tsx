import { fr } from "@/lib/i18n/fr";
import type { MapProject } from "@/features/map/types";

const t = fr.map.steps;

/** Étapes d'un projet, reliées comme une frise : faite, en cours, à faire. */
export default function ProjectSteps({ project }: { project: MapProject }) {
  const steps = project.steps ?? [];
  if (steps.length === 0) return null;
  return (
    <ol
      aria-label={t.label.replace("{project}", project.name)}
      data-testid="project-steps"
      className="flex min-w-0 flex-1 items-start overflow-x-auto"
    >
      {steps.map((step, index) => {
        const done = step.status === "DONE";
        const current = step.status === "IN_PROGRESS";
        return (
          <li
            key={`${index}-${step.name}`}
            className="flex min-w-24 flex-1 flex-col items-center"
          >
            <div className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 ${index === 0 ? "invisible" : done || current ? "bg-brand-500" : "bg-slate-300"}`}
              />
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                  done
                    ? "border-brand-600 bg-brand-600 text-white"
                    : current
                      ? "border-brand-600 text-brand-700 bg-white"
                      : "border-slate-300 bg-white text-slate-500"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 ${index === steps.length - 1 ? "invisible" : done ? "bg-brand-500" : "bg-slate-300"}`}
              />
            </div>
            <span
              className="mt-1 max-w-28 truncate px-1 text-center text-xs text-slate-700"
              title={step.name}
            >
              {step.name}
            </span>
            <span className="sr-only">
              {done ? t.done : current ? t.inProgress : t.todo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
