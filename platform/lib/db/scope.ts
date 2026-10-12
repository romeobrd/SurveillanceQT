// Réécriture des requêtes Prisma pour imposer l'entreprise de la session (fonction pure, testée).
// Principe : liste blanche des opérations ; tout ce qui n'est pas explicitement géré est refusé.

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolationError";
  }
}

/** Modèles portant une colonne organizationId. Un test vérifie cette liste contre schema.prisma. */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  "User",
  "Team",
  "Person",
  "Layout",
  "Zone",
  "Workstation",
  "StockItem",
  "StockMovement",
  "Asset",
  "Project",
  "ProjectStep",
  "PresenceStatus",
  "AuditLog",
  "PrivacyRequest",
]);

type Args = Record<string, unknown>;

const FILTER_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const UNIQUE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
]);
const MANY_WRITE_OPS = new Set([
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);
const CREATE_MANY_OPS = new Set(["createMany", "createManyAndReturn"]);

/** Clés qui, dans une donnée d'écriture, déclenchent une écriture imbriquée sur une autre table. */
const NESTED_WRITE_KEYS = new Set([
  "connect",
  "connectOrCreate",
  "create",
  "createMany",
  "delete",
  "deleteMany",
  "disconnect",
  "set",
  "update",
  "updateMany",
  "upsert",
]);

/** Colonnes Json dont le contenu est libre (jamais interprété comme écriture imbriquée). */
const JSON_FIELDS: Readonly<Record<string, ReadonlySet<string>>> = {
  Layout: new Set(["data"]),
};

function isPlainObject(value: unknown): value is Args {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function withFilter(where: unknown, key: string, value: string): Args {
  return isPlainObject(where) && Object.keys(where).length > 0
    ? { AND: [where, { [key]: value }] }
    : { [key]: value };
}

function assertNoNestedWrite(model: string, data: Args): void {
  for (const [field, value] of Object.entries(data)) {
    if (JSON_FIELDS[model]?.has(field)) continue;
    if (
      isPlainObject(value) &&
      Object.keys(value).some((key) => NESTED_WRITE_KEYS.has(key))
    ) {
      throw new TenantViolationError(
        `Écriture imbriquée interdite sur ${model}.${field}`,
      );
    }
  }
}

/** Impose organizationId sur une donnée de création ; refuse une autre entreprise. */
function scopeCreateData(
  model: string,
  data: unknown,
  organizationId: string,
): Args {
  if (!isPlainObject(data))
    throw new TenantViolationError(`Donnée de création invalide pour ${model}`);
  if ("organization" in data)
    throw new TenantViolationError(
      `Relation "organization" interdite sur ${model}`,
    );
  if (
    data.organizationId !== undefined &&
    data.organizationId !== organizationId
  ) {
    throw new TenantViolationError(
      `organizationId étranger refusé sur ${model}`,
    );
  }
  assertNoNestedWrite(model, data);
  return { ...data, organizationId };
}

/** Refuse tout changement d'entreprise lors d'une modification. */
function scopeUpdateData(model: string, data: unknown): Args {
  if (!isPlainObject(data))
    throw new TenantViolationError(
      `Donnée de modification invalide pour ${model}`,
    );
  if ("organization" in data || "organizationId" in data) {
    throw new TenantViolationError(
      `Changer l'entreprise d'une ligne est interdit (${model})`,
    );
  }
  assertNoNestedWrite(model, data);
  return data;
}

export function scopeArgs(
  model: string,
  operation: string,
  args: unknown,
  organizationId: string,
): Args {
  if (!organizationId)
    throw new TenantViolationError("organizationId manquant");
  const input: Args = isPlainObject(args) ? args : {};

  // Organization : une seule ligne visible (la sienne), jamais créée ni supprimée par ce chemin
  if (model === "Organization") {
    if (FILTER_OPS.has(operation)) {
      return { ...input, where: withFilter(input.where, "id", organizationId) };
    }
    if (
      operation === "findUnique" ||
      operation === "findUniqueOrThrow" ||
      operation === "update"
    ) {
      // Filtre ajouté (et non écrasé) : demander une autre entreprise ne trouve rien
      const where = (input.where ?? {}) as Args;
      const callerAnd = where.AND === undefined ? [] : [where.AND].flat();
      const next: Args = {
        ...input,
        where: { ...where, AND: [...callerAnd, { id: organizationId }] },
      };
      if (operation === "update")
        next.data = scopeUpdateData(model, input.data);
      return next;
    }
    throw new TenantViolationError(
      `Opération ${operation} interdite sur Organization`,
    );
  }

  if (!TENANT_MODELS.has(model)) {
    throw new TenantViolationError(
      `Modèle ${model} inaccessible via la couche multi-tenant`,
    );
  }

  if (FILTER_OPS.has(operation)) {
    return {
      ...input,
      where: withFilter(input.where, "organizationId", organizationId),
    };
  }
  if (UNIQUE_OPS.has(operation)) {
    const next: Args = {
      ...input,
      where: { ...(input.where as Args), organizationId },
    };
    if (operation === "update") next.data = scopeUpdateData(model, input.data);
    return next;
  }
  if (MANY_WRITE_OPS.has(operation)) {
    const next: Args = {
      ...input,
      where: withFilter(input.where, "organizationId", organizationId),
    };
    if (operation !== "deleteMany")
      next.data = scopeUpdateData(model, input.data);
    return next;
  }
  if (operation === "create") {
    return {
      ...input,
      data: scopeCreateData(model, input.data, organizationId),
    };
  }
  if (CREATE_MANY_OPS.has(operation)) {
    const rows = Array.isArray(input.data) ? input.data : [input.data];
    return {
      ...input,
      data: rows.map((row) => scopeCreateData(model, row, organizationId)),
    };
  }
  if (operation === "upsert") {
    return {
      ...input,
      where: { ...(input.where as Args), organizationId },
      create: scopeCreateData(model, input.create, organizationId),
      update: scopeUpdateData(model, input.update),
    };
  }
  throw new TenantViolationError(
    `Opération ${operation} non autorisée sur ${model}`,
  );
}
