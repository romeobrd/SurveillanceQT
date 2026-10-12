import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scopeArgs, TENANT_MODELS, TenantViolationError } from "@/lib/db/scope";

const A = "org_a";
const B = "org_b";

describe("TENANT_MODELS", () => {
  it("couvre exactement les modèles qui portent organizationId dans schema.prisma", () => {
    const schema = readFileSync(
      path.resolve(__dirname, "../../prisma/schema.prisma"),
      "utf8",
    );
    const withOrg = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+organizationId\s/m.test(body))
      .map(([, name]) => name)
      .sort();
    expect([...TENANT_MODELS].sort()).toEqual(withOrg);
  });
});

describe("lectures", () => {
  it("ajoute le filtre d'entreprise sans perdre le filtre de l'appelant", () => {
    expect(
      scopeArgs("Person", "findMany", { where: { status: "ACTIVE" } }, A),
    ).toEqual({
      where: { AND: [{ status: "ACTIVE" }, { organizationId: A }] },
    });
    expect(scopeArgs("Person", "count", undefined, A)).toEqual({
      where: { organizationId: A },
    });
  });

  it("neutralise un filtre qui vise une autre entreprise", () => {
    const scoped = scopeArgs(
      "Person",
      "findFirst",
      { where: { organizationId: B } },
      A,
    );
    expect(scoped).toEqual({
      where: { AND: [{ organizationId: B }, { organizationId: A }] },
    });
  });

  it("force l'entreprise sur les lectures par clé unique", () => {
    expect(
      scopeArgs(
        "Person",
        "findUnique",
        { where: { id: "p1", organizationId: B } },
        A,
      ),
    ).toEqual({
      where: { id: "p1", organizationId: A },
    });
  });
});

describe("écritures", () => {
  it("impose organizationId à la création", () => {
    expect(scopeArgs("Team", "create", { data: { name: "x" } }, A)).toEqual({
      data: { name: "x", organizationId: A },
    });
  });

  it("refuse la création pour une autre entreprise", () => {
    expect(() =>
      scopeArgs(
        "Team",
        "create",
        { data: { name: "x", organizationId: B } },
        A,
      ),
    ).toThrow(TenantViolationError);
    expect(() =>
      scopeArgs(
        "Team",
        "createMany",
        { data: [{ name: "x" }, { name: "y", organizationId: B }] },
        A,
      ),
    ).toThrow(TenantViolationError);
  });

  it("refuse de déplacer une ligne vers une autre entreprise", () => {
    expect(() =>
      scopeArgs(
        "Team",
        "update",
        { where: { id: "t" }, data: { organizationId: B } },
        A,
      ),
    ).toThrow(TenantViolationError);
    expect(() =>
      scopeArgs(
        "Team",
        "updateMany",
        { data: { organization: { connect: { id: B } } } },
        A,
      ),
    ).toThrow(TenantViolationError);
  });

  it("refuse les écritures imbriquées (elles contourneraient le filtre sur une autre table)", () => {
    expect(() =>
      scopeArgs(
        "Team",
        "update",
        {
          where: { id: "t" },
          data: { people: { create: { firstName: "x" } } },
        },
        A,
      ),
    ).toThrow(TenantViolationError);
    expect(() =>
      scopeArgs(
        "Team",
        "create",
        { data: { name: "x", projects: { connect: { id: "p" } } } },
        A,
      ),
    ).toThrow(TenantViolationError);
  });

  it("autorise un contenu libre dans la colonne Json de la carte", () => {
    expect(() =>
      scopeArgs(
        "Layout",
        "create",
        { data: { version: 1, data: { create: "texte libre", connect: 1 } } },
        A,
      ),
    ).not.toThrow();
  });

  it("filtre les écritures de masse", () => {
    expect(
      scopeArgs("Asset", "deleteMany", { where: { state: "RETIRED" } }, A),
    ).toEqual({
      where: { AND: [{ state: "RETIRED" }, { organizationId: A }] },
    });
    expect(
      scopeArgs("Asset", "updateMany", { data: { state: "BROKEN" } }, A),
    ).toEqual({
      where: { organizationId: A },
      data: { state: "BROKEN" },
    });
  });

  it("encadre upsert des deux côtés", () => {
    const scoped = scopeArgs(
      "Zone",
      "upsert",
      {
        where: { id: "z" },
        create: { key: "z1", name: "n", type: "t" },
        update: { name: "m" },
      },
      A,
    );
    expect(scoped).toMatchObject({
      where: { id: "z", organizationId: A },
      create: { organizationId: A },
      update: { name: "m" },
    });
  });
});

describe("liste blanche", () => {
  it("refuse une opération inconnue", () => {
    expect(() => scopeArgs("Person", "findRaw", {}, A)).toThrow(
      TenantViolationError,
    );
  });

  it("refuse un modèle hors couche multi-tenant", () => {
    expect(() => scopeArgs("LoginAttempt", "findMany", {}, A)).toThrow(
      TenantViolationError,
    );
  });

  it("refuse un identifiant d'entreprise vide", () => {
    expect(() => scopeArgs("Person", "findMany", {}, "")).toThrow(
      TenantViolationError,
    );
  });

  it("ne laisse voir que sa propre ligne Organization, sans création ni suppression", () => {
    expect(scopeArgs("Organization", "findMany", {}, A)).toEqual({
      where: { id: A },
    });
    expect(
      scopeArgs("Organization", "findUnique", { where: { id: B } }, A),
    ).toEqual({ where: { id: B, AND: [{ id: A }] } });
    expect(() =>
      scopeArgs("Organization", "create", { data: { name: "x" } }, A),
    ).toThrow(TenantViolationError);
    expect(() =>
      scopeArgs("Organization", "delete", { where: { id: A } }, A),
    ).toThrow(TenantViolationError);
    expect(() => scopeArgs("Organization", "deleteMany", {}, A)).toThrow(
      TenantViolationError,
    );
  });
});
