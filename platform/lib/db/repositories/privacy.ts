// Droits des personnes (SPEC §8.4), présence déclarative (§8.2), réglages de conservation (§8.6)
// et journal d'audit (§8.7).
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import {
  AUDIT_PAGE_SIZE,
  AuditQuerySchema,
  PresenceInputSchema,
  PrivacyRequestInputSchema,
  PrivacyRequestQuerySchema,
  REQUEST_TRANSITIONS,
  RequestStatusSchema,
  type AuditQuery,
  type PrivacyRequestInput,
} from "@/features/privacy/schemas";
import {
  OrganizationSettingsSchema,
  todayInParis,
  type OrganizationSettings,
} from "@/lib/privacy/retention";
import { recordAudit } from "../audit";
import { InvalidOperationError, NotFoundError } from "../errors";
import { anonymizePerson } from "../privacy-core";
import type { TenantDb } from "../tenant";

type RequestType = "ACCESS" | "RECTIFICATION" | "ERASURE";
type RequestStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "REJECTED";
type PresenceKind = "OFFICE" | "REMOTE" | "ABSENT";

export interface RequestView {
  id: string;
  type: RequestType;
  status: RequestStatus;
  details: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface AdminRequestView extends RequestView {
  requesterName: string;
  requesterRole: string;
}

const requestSelect = {
  id: true,
  type: true,
  status: true,
  details: true,
  createdAt: true,
  resolvedAt: true,
} as const;

/** « Mes données » : chacun consulte, exporte et fait valoir ses droits sur SES données, jamais celles des autres. */
export function privacyRepository(db: TenantDb, context: AccessContext) {
  async function ownData() {
    const personId = context.personId;
    if (!personId) return null;
    const [
      person,
      account,
      workstations,
      assets,
      history,
      requests,
      organization,
    ] = await Promise.all([
      db.person.findUnique({
        where: { id: personId },
        select: {
          firstName: true,
          lastName: true,
          workEmail: true,
          jobTitle: true,
          status: true,
          team: { select: { name: true } },
        },
      }),
      db.user.findUnique({
        where: { id: context.userId },
        select: { email: true, role: true },
      }),
      db.workstation.findMany({
        where: { personId },
        select: { elementKey: true, zone: { select: { name: true } } },
      }),
      db.asset.findMany({
        where: { personId },
        select: {
          type: true,
          brand: true,
          model: true,
          serialNumber: true,
          state: true,
        },
      }),
      db.assetAssignment.findMany({
        where: { personId },
        select: {
          assignedAt: true,
          releasedAt: true,
          asset: { select: { type: true, brand: true, model: true } },
        },
        orderBy: { assignedAt: "asc" },
      }),
      db.privacyRequest.findMany({
        where: { requesterId: context.userId },
        select: requestSelect,
        orderBy: { createdAt: "desc" },
      }),
      db.organization.findUnique({
        where: { id: context.organizationId },
        select: { name: true, presenceEnabled: true },
      }),
    ]);
    const presence = organization?.presenceEnabled
      ? await db.presenceStatus.findFirst({
          where: { personId, date: todayInParis(new Date()) },
          select: { status: true, date: true },
        })
      : null;
    return {
      personId,
      person,
      account,
      workstations,
      assets,
      history,
      requests,
      organization,
      presence,
    };
  }

  return {
    /** Consultation de ses propres données (journalisée). */
    async getMyData() {
      assertPermission(context, "privacy:self");
      const data = await ownData();
      await recordAudit(db, context, {
        action: "privacy.view",
        resourceType: "Person",
        resourceId: data?.personId ?? null,
      });
      return data;
    },

    /** Export JSON lisible de ses propres données (droits d'accès et de portabilité), journalisé. */
    async exportMyData() {
      assertPermission(context, "privacy:self");
      const data = await ownData();
      if (!data?.person) throw new NotFoundError("Données personnelles");
      await recordAudit(db, context, {
        action: "privacy.export",
        resourceType: "Person",
        resourceId: data.personId,
      });
      return {
        format: "gestion-entreprise/mes-donnees",
        version: 1,
        generatedAt: new Date().toISOString(),
        organization: data.organization?.name ?? null,
        person: {
          firstName: data.person.firstName,
          lastName: data.person.lastName,
          workEmail: data.person.workEmail,
          jobTitle: data.person.jobTitle,
          team: data.person.team?.name ?? null,
          status: data.person.status,
        },
        account: data.account
          ? { email: data.account.email, role: data.account.role }
          : null,
        workstations: data.workstations.map((station) => ({
          workstation: station.elementKey,
          zone: station.zone.name,
        })),
        assets: data.assets,
        assetHistory: data.history.map((entry) => ({
          asset: `${entry.asset.type} ${entry.asset.brand} ${entry.asset.model}`,
          assignedAt: entry.assignedAt.toISOString(),
          releasedAt: entry.releasedAt?.toISOString() ?? null,
        })),
        presenceToday: data.presence
          ? {
              status: data.presence.status,
              date: data.presence.date.toISOString().slice(0, 10),
            }
          : null,
        privacyRequests: data.requests.map((request) => ({
          type: request.type,
          status: request.status,
          details: request.details,
          createdAt: request.createdAt.toISOString(),
          resolvedAt: request.resolvedAt?.toISOString() ?? null,
        })),
      };
    },

    /** Demande d'accès, de rectification ou d'effacement. Une seule demande ouverte par type. */
    async createRequest(input: PrivacyRequestInput): Promise<{ id: string }> {
      assertPermission(context, "privacy:self");
      const data = PrivacyRequestInputSchema.parse(input);
      const open = await db.privacyRequest.count({
        where: {
          requesterId: context.userId,
          type: data.type,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      });
      if (open > 0)
        throw new InvalidOperationError(
          "Une demande de ce type est déjà en cours",
        );
      const request = await db.privacyRequest.create({
        data: {
          organizationId: context.organizationId,
          requesterId: context.userId,
          type: data.type,
          details: data.details,
        },
        select: { id: true },
      });
      await recordAudit(db, context, {
        action: "privacy.request.create",
        resourceType: "PrivacyRequest",
        resourceId: request.id,
      });
      return request;
    },

    async listMyRequests(): Promise<RequestView[]> {
      assertPermission(context, "privacy:self");
      return db.privacyRequest.findMany({
        where: { requesterId: context.userId },
        select: requestSelect,
        orderBy: { createdAt: "desc" },
      });
    },

    // ---- Suivi des demandes (administrateur) ----

    async listRequests(
      input: { status?: unknown } = {},
    ): Promise<AdminRequestView[]> {
      assertPermission(context, "privacy:manageRequests");
      const { status } = PrivacyRequestQuerySchema.parse(input);
      const rows = await db.privacyRequest.findMany({
        where: status ? { status } : {},
        select: {
          ...requestSelect,
          requester: {
            select: {
              role: true,
              person: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
      await recordAudit(db, context, {
        action: "privacy.request.list",
        resourceType: "PrivacyRequest",
      });
      return rows.map(({ requester, ...request }) => ({
        ...request,
        requesterName: requester.person
          ? `${requester.person.firstName} ${requester.person.lastName}`
          : "—",
        requesterRole: requester.role,
      }));
    },

    async updateRequestStatus(
      id: string,
      status: RequestStatus,
    ): Promise<void> {
      assertPermission(context, "privacy:manageRequests");
      const next = RequestStatusSchema.parse(status);
      const request = await db.privacyRequest.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!request) throw new NotFoundError("Demande");
      if (!REQUEST_TRANSITIONS[request.status].includes(next))
        throw new InvalidOperationError("Transition de statut impossible");
      await db.privacyRequest.update({
        where: { id },
        data: {
          status: next,
          resolvedAt:
            next === "DONE" || next === "REJECTED" ? new Date() : null,
        },
      });
      await recordAudit(db, context, {
        action: "privacy.request.update",
        resourceType: "PrivacyRequest",
        resourceId: id,
      });
    },

    /** Exécute une demande d'effacement : anonymise la personne qui l'a faite, puis clôt la demande. */
    async executeErasure(id: string): Promise<void> {
      assertPermission(context, "privacy:manageRequests");
      const request = await db.privacyRequest.findUnique({
        where: { id },
        select: {
          type: true,
          status: true,
          requester: { select: { personId: true } },
        },
      });
      if (!request) throw new NotFoundError("Demande");
      if (request.type !== "ERASURE")
        throw new InvalidOperationError(
          "Cette demande n'est pas une demande d'effacement",
        );
      if (request.status === "DONE" || request.status === "REJECTED")
        throw new InvalidOperationError("Demande déjà close");
      const personId = request.requester.personId;
      if (!personId)
        throw new InvalidOperationError(
          "Aucun collaborateur n'est rattaché à ce compte",
        );
      await anonymizePerson(context.organizationId, personId);
      await db.privacyRequest.update({
        where: { id },
        data: { status: "DONE", resolvedAt: new Date(), details: "" },
      });
      await recordAudit(db, context, {
        action: "person.anonymize",
        resourceType: "Person",
        resourceId: personId,
      });
      await recordAudit(db, context, {
        action: "privacy.request.update",
        resourceType: "PrivacyRequest",
        resourceId: id,
      });
    },
  };
}

/**
 * Présence déclarative facultative (SPEC §8.2) : saisie par le salarié LUI-MÊME, désactivable par l'entreprise,
 * purgée chaque nuit, jamais historisée, jamais affichée par personne (seulement des totaux).
 * Volontairement NON journalisée : un journal des déclarations serait précisément l'historique de présence interdit.
 */
export function presenceRepository(db: TenantDb, context: AccessContext) {
  async function enabled(): Promise<boolean> {
    const organization = await db.organization.findUnique({
      where: { id: context.organizationId },
      select: { presenceEnabled: true },
    });
    return organization?.presenceEnabled ?? false;
  }

  return {
    async getMine(): Promise<{
      enabled: boolean;
      status: PresenceKind | null;
    }> {
      assertPermission(context, "presence:declare");
      if (!(await enabled()) || !context.personId)
        return { enabled: false, status: null };
      const row = await db.presenceStatus.findFirst({
        where: { personId: context.personId, date: todayInParis(new Date()) },
        select: { status: true },
      });
      return { enabled: true, status: row?.status ?? null };
    },

    async setMine(kind: PresenceKind): Promise<void> {
      assertPermission(context, "presence:declare");
      const status = PresenceInputSchema.parse(kind);
      if (!context.personId)
        throw new InvalidOperationError(
          "Aucun collaborateur n'est rattaché à ce compte",
        );
      if (!(await enabled()))
        throw new InvalidOperationError(
          "La présence déclarative est désactivée",
        );
      const date = todayInParis(new Date());
      await db.presenceStatus.upsert({
        where: { personId_date: { personId: context.personId, date } },
        create: {
          organizationId: context.organizationId,
          personId: context.personId,
          status,
          date,
        },
        update: { status },
      });
    },

    async clearMine(): Promise<void> {
      assertPermission(context, "presence:declare");
      if (!context.personId) return;
      await db.presenceStatus.deleteMany({
        where: { personId: context.personId },
      });
    },

    /** Totaux du jour, sans aucun nom (null quand la fonction est désactivée). */
    async todayCounts(): Promise<{
      office: number;
      remote: number;
      absent: number;
    } | null> {
      assertPermission(context, "map:read");
      if (!(await enabled())) return null;
      const groups = await db.presenceStatus.groupBy({
        by: ["status"],
        where: { date: todayInParis(new Date()) },
        _count: { _all: true },
      });
      const count = (kind: PresenceKind) =>
        groups.find((group) => group.status === kind)?._count._all ?? 0;
      return {
        office: count("OFFICE"),
        remote: count("REMOTE"),
        absent: count("ABSENT"),
      };
    },
  };
}

/** Réglages de l'entreprise : présence déclarative et durées de conservation (administrateur). */
export function settingsRepository(db: TenantDb, context: AccessContext) {
  return {
    async get(): Promise<OrganizationSettings> {
      assertPermission(context, "org:settings");
      const organization = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: {
          presenceEnabled: true,
          auditRetentionDays: true,
          privacyRequestRetentionDays: true,
          departedPersonRetentionDays: true,
        },
      });
      if (!organization) throw new NotFoundError("Entreprise");
      return organization;
    },

    async update(input: unknown): Promise<void> {
      assertPermission(context, "org:settings");
      const data = OrganizationSettingsSchema.parse(input);
      await db.organization.update({
        where: { id: context.organizationId },
        data,
      });
      // Désactiver la présence efface immédiatement toutes les déclarations
      if (!data.presenceEnabled) await db.presenceStatus.deleteMany({});
      await recordAudit(db, context, {
        action: "org.settings.update",
        resourceType: "Organization",
        resourceId: context.organizationId,
      });
    },
  };
}

export interface AuditRowView {
  id: string;
  createdAt: Date;
  action: string;
  resourceType: string;
  resourceId: string | null;
  /** Rôle de l'acteur (jamais son nom) et référence abrégée de son compte ; null pour une tâche automatique. */
  actorRole: string | null;
  actorRef: string | null;
}

/** Consultation du journal d'audit (administrateur) : identifiants et rôles seulement, aucune donnée personnelle. */
export function auditRepository(db: TenantDb, context: AccessContext) {
  return {
    async list(input: Partial<AuditQuery> = {}): Promise<{
      rows: AuditRowView[];
      total: number;
      page: number;
      pageCount: number;
    }> {
      assertPermission(context, "audit:read");
      const query = AuditQuerySchema.parse(input);
      const where = {
        ...(query.action ? { action: query.action } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to
                  ? { lt: new Date(query.to.getTime() + 86_400_000) }
                  : {}),
              },
            }
          : {}),
      };
      const [total, rows] = await Promise.all([
        db.auditLog.count({ where }),
        db.auditLog.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * AUDIT_PAGE_SIZE,
          take: AUDIT_PAGE_SIZE,
        }),
      ]);
      const actorIds = [
        ...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : []))),
      ];
      const users = actorIds.length
        ? await db.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, role: true },
          })
        : [];
      const roles = new Map(users.map((user) => [user.id, user.role]));
      return {
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
        rows: rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          action: row.action,
          resourceType: row.resourceType,
          resourceId: row.resourceId,
          actorRole: row.actorId ? (roles.get(row.actorId) ?? null) : null,
          actorRef: row.actorId ? row.actorId.slice(0, 8) : null,
        })),
      };
    },

    /** Actions présentes dans le journal (pour le filtre). */
    async actions(): Promise<string[]> {
      assertPermission(context, "audit:read");
      const groups = await db.auditLog.groupBy({
        by: ["action"],
        _count: { _all: true },
        orderBy: { action: "asc" },
      });
      return groups.map((group) => group.action);
    },
  };
}
