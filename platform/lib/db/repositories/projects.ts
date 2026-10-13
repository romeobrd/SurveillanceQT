// Projets : étapes ordonnées, progression calculée à partir des étapes terminées.
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import {
  computeProgress,
  computeProjectState,
  swapTarget,
  type ProjectState,
} from "@/features/projects/progress";
import {
  ProjectInputSchema,
  ProjectQuerySchema,
  StepNameSchema,
  StepStatusSchema,
  type ProjectInput,
  type ProjectQuery,
} from "@/features/projects/schemas";
import { recordAudit } from "../audit";
import { NotFoundError } from "../errors";
import type { TenantDb } from "../tenant";

export interface ProjectView {
  id: string;
  name: string;
  description: string;
  teamId: string | null;
  teamName: string | null;
  progress: number;
  state: ProjectState;
  stepCount: number;
}

export interface StepView {
  id: string;
  name: string;
  order: number;
  status: "TODO" | "IN_PROGRESS" | "DONE";
}

export function projectsRepository(db: TenantDb, context: AccessContext) {
  const projectSelect = {
    id: true,
    name: true,
    description: true,
    teamId: true,
    team: { select: { name: true } },
    steps: { select: { status: true } },
  } as const;

  const toView = (row: {
    id: string;
    name: string;
    description: string;
    teamId: string | null;
    team: { name: string } | null;
    steps: Array<{ status: StepView["status"] }>;
  }): ProjectView => ({
    id: row.id,
    name: row.name,
    description: row.description,
    teamId: row.teamId,
    teamName: row.team?.name ?? null,
    progress: computeProgress(row.steps),
    state: computeProjectState(row.steps),
    stepCount: row.steps.length,
  });

  return {
    async list(input: Partial<ProjectQuery> = {}): Promise<ProjectView[]> {
      assertPermission(context, "project:read");
      const query = ProjectQuerySchema.parse(input);
      const rows = await db.project.findMany({
        where: {
          ...(query.teamId ? { teamId: query.teamId } : {}),
          ...(query.search
            ? { name: { contains: query.search, mode: "insensitive" } }
            : {}),
        },
        select: projectSelect,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      const views = rows.map(toView);
      return query.state === "ALL"
        ? views
        : views.filter((view) => view.state === query.state);
    },

    async get(
      id: string,
    ): Promise<{ project: ProjectView; steps: StepView[] } | null> {
      assertPermission(context, "project:read");
      const row = await db.project.findUnique({
        where: { id },
        select: projectSelect,
      });
      if (!row) return null;
      const steps = await db.projectStep.findMany({
        where: { projectId: id },
        select: { id: true, name: true, order: true, status: true },
        orderBy: { order: "asc" },
      });
      return { project: toView(row), steps };
    },

    async create(input: ProjectInput): Promise<{ id: string }> {
      assertPermission(context, "project:write");
      const data = ProjectInputSchema.parse(input);
      const project = await db.project.create({
        data: {
          ...data,
          teamId: data.teamId ?? null,
          organizationId: context.organizationId,
        },
        select: { id: true },
      });
      await recordAudit(db, context, {
        action: "project.create",
        resourceType: "Project",
        resourceId: project.id,
      });
      return project;
    },

    async update(id: string, input: ProjectInput): Promise<void> {
      assertPermission(context, "project:write");
      const data = ProjectInputSchema.parse(input);
      await db.project.update({
        where: { id },
        data: { ...data, teamId: data.teamId ?? null },
      });
      await recordAudit(db, context, {
        action: "project.update",
        resourceType: "Project",
        resourceId: id,
      });
    },

    /** Supprime le projet et toutes ses étapes (après confirmation côté interface). */
    async delete(id: string): Promise<void> {
      assertPermission(context, "project:write");
      await db.$transaction(async (tx) => {
        const project = await tx.project.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!project) throw new NotFoundError("Projet");
        await tx.projectStep.deleteMany({ where: { projectId: id } });
        await tx.project.delete({ where: { id } });
      });
      await recordAudit(db, context, {
        action: "project.delete",
        resourceType: "Project",
        resourceId: id,
      });
    },

    async addStep(projectId: string, name: string): Promise<{ id: string }> {
      assertPermission(context, "project:write");
      const parsed = StepNameSchema.parse(name);
      const step = await db.$transaction(async (tx) => {
        const project = await tx.project.findUnique({
          where: { id: projectId },
          select: { id: true },
        });
        if (!project) throw new NotFoundError("Projet");
        const last = await tx.projectStep.findFirst({
          where: { projectId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        return tx.projectStep.create({
          data: {
            organizationId: context.organizationId,
            projectId,
            name: parsed,
            order: (last?.order ?? 0) + 1,
          },
          select: { id: true },
        });
      });
      await recordAudit(db, context, {
        action: "project.step.add",
        resourceType: "ProjectStep",
        resourceId: step.id,
      });
      return step;
    },

    async renameStep(stepId: string, name: string): Promise<void> {
      assertPermission(context, "project:write");
      await db.projectStep.update({
        where: { id: stepId },
        data: { name: StepNameSchema.parse(name) },
      });
      await recordAudit(db, context, {
        action: "project.step.update",
        resourceType: "ProjectStep",
        resourceId: stepId,
      });
    },

    async setStepStatus(
      stepId: string,
      status: StepView["status"],
    ): Promise<void> {
      assertPermission(context, "project:write");
      await db.projectStep.update({
        where: { id: stepId },
        data: { status: StepStatusSchema.parse(status) },
      });
      await recordAudit(db, context, {
        action: "project.step.status",
        resourceType: "ProjectStep",
        resourceId: stepId,
      });
    },

    async deleteStep(stepId: string): Promise<void> {
      assertPermission(context, "project:write");
      const step = await db.projectStep.findUnique({
        where: { id: stepId },
        select: { id: true },
      });
      if (!step) throw new NotFoundError("Étape");
      await db.projectStep.delete({ where: { id: stepId } });
      await recordAudit(db, context, {
        action: "project.step.delete",
        resourceType: "ProjectStep",
        resourceId: stepId,
      });
    },

    /** Échange l'étape avec sa voisine (ordre unique par projet : passage par une valeur temporaire). */
    async moveStep(stepId: string, direction: "up" | "down"): Promise<void> {
      assertPermission(context, "project:write");
      await db.$transaction(async (tx) => {
        const step = await tx.projectStep.findUnique({
          where: { id: stepId },
          select: { id: true, order: true, projectId: true },
        });
        if (!step) throw new NotFoundError("Étape");
        const siblings = await tx.projectStep.findMany({
          where: { projectId: step.projectId },
          select: { id: true, order: true },
        });
        const neighbour = swapTarget(siblings, stepId, direction);
        if (!neighbour) return;
        await tx.projectStep.update({
          where: { id: step.id },
          data: { order: -1 - step.order },
        });
        await tx.projectStep.update({
          where: { id: neighbour.id },
          data: { order: step.order },
        });
        await tx.projectStep.update({
          where: { id: step.id },
          data: { order: neighbour.order },
        });
      });
      await recordAudit(db, context, {
        action: "project.step.move",
        resourceType: "ProjectStep",
        resourceId: stepId,
      });
    },
  };
}
