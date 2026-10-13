import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addStepAction,
  deleteProjectAction,
  deleteStepAction,
  moveStepAction,
  setStepStatusAction,
  updateProjectAction,
} from "../actions";
import ProjectFields from "@/components/ProjectForm";
import ActionForm from "@/components/ui/ActionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { TextInput } from "@/components/ui/fields";
import {
  Badge,
  Card,
  ProgressBar,
  secondaryLink,
} from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.projects.title} — ${fr.app.name}`,
};

const tones = { TODO: "neutral", IN_PROGRESS: "warn", DONE: "ok" } as const;
const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, repos } = await getAppContext();
  const detail = await repos.projects.get(id);
  if (!detail) notFound();
  const { project, steps } = detail;
  const canWrite = can(session.role, "project:write");
  const teams = canWrite ? await repos.teams.list() : [];

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/projets" className={secondaryLink}>
            {fr.common.back}
          </Link>
          <Link href={`/carte?project=${project.id}`} className={secondaryLink}>
            {fr.projects.openOnMap}
          </Link>
          {canWrite && (
            <ConfirmDialog
              triggerLabel={fr.common.delete}
              title={fr.projects.deleteTitle}
              description={fr.projects.deleteBody}
              action={deleteProjectAction}
            >
              <input type="hidden" name="id" value={project.id} />
            </ConfirmDialog>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProgressBar
          value={project.progress}
          label={`${project.name} : ${project.progress} %`}
        />
        <span className="text-sm text-slate-600">
          {fr.projects.progress} ({project.stepCount} {fr.projects.stepsCount})
        </span>
        {project.teamName && <Badge tone="neutral">{project.teamName}</Badge>}
      </div>
      {project.description && (
        <p className="mb-6 text-sm text-slate-700">{project.description}</p>
      )}

      <h2 className="mb-2 text-lg font-semibold">{fr.projects.steps}</h2>
      {steps.length === 0 ? (
        <p className="mb-4 text-sm text-slate-600">{fr.projects.noSteps}</p>
      ) : (
        <ol className="mb-4 flex flex-col gap-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              data-testid="step"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{index + 1}.</span>
                <span className="font-medium">{step.name}</span>
                <Badge tone={tones[step.status]}>
                  {fr.projects.stepStatus[step.status]}
                </Badge>
              </span>
              {canWrite && (
                <span className="flex flex-wrap items-center gap-2">
                  <ActionForm
                    action={setStepStatusAction}
                    hideSubmit
                    className="flex gap-1"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="stepId" value={step.id} />
                    {(["TODO", "IN_PROGRESS", "DONE"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="submit"
                          name="status"
                          value={status}
                          disabled={step.status === status}
                          aria-label={`${fr.projects.stepStatus[status]} — ${step.name}`}
                          className={smallButton}
                        >
                          {fr.projects.stepStatus[status]}
                        </button>
                      ),
                    )}
                  </ActionForm>
                  <ActionForm
                    action={moveStepAction}
                    hideSubmit
                    className="flex gap-1"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="stepId" value={step.id} />
                    <button
                      type="submit"
                      name="direction"
                      value="up"
                      disabled={index === 0}
                      aria-label={`${fr.projects.moveUp} — ${step.name}`}
                      className={smallButton}
                    >
                      ↑
                    </button>
                    <button
                      type="submit"
                      name="direction"
                      value="down"
                      disabled={index === steps.length - 1}
                      aria-label={`${fr.projects.moveDown} — ${step.name}`}
                      className={smallButton}
                    >
                      ↓
                    </button>
                  </ActionForm>
                  <ConfirmDialog
                    triggerLabel={fr.projects.deleteStep}
                    title={fr.projects.deleteStep}
                    description={step.name}
                    action={deleteStepAction}
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="stepId" value={step.id} />
                  </ConfirmDialog>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {canWrite && (
        <div className="grid gap-4">
          <Card title={fr.projects.newStep}>
            <ActionForm
              action={addStepAction}
              submitLabel={fr.projects.addStep}
            >
              <input type="hidden" name="projectId" value={project.id} />
              <TextInput
                id="name"
                label={fr.projects.stepName}
                required
                maxLength={120}
              />
            </ActionForm>
          </Card>
          <Card title={fr.projects.editTitle}>
            <ActionForm action={updateProjectAction}>
              <input type="hidden" name="id" value={project.id} />
              <ProjectFields teams={teams} defaults={project} />
            </ActionForm>
          </Card>
        </div>
      )}
    </div>
  );
}
