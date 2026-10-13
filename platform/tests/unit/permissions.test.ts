import { describe, expect, it } from "vitest";
import {
  assertPermission,
  can,
  ForbiddenError,
  PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";

const permissions = Object.keys(PERMISSIONS) as Permission[];

describe("droits par rôle", () => {
  it("l'admin a tous les droits", () => {
    for (const permission of permissions)
      expect(can("ADMIN", permission)).toBe(true);
  });

  it("l'employé ne peut rien modifier ni administrer", () => {
    const forbidden = permissions.filter((p) =>
      /write|assign|manage|settings|audit|Details/.test(p),
    );
    expect(forbidden.length).toBeGreaterThan(5);
    for (const permission of forbidden)
      expect(can("EMPLOYEE", permission)).toBe(false);
  });

  it("l'employé peut consulter la carte et l'annuaire minimal", () => {
    expect(can("EMPLOYEE", "map:read")).toBe(true);
    expect(can("EMPLOYEE", "people:readDirectory")).toBe(true);
  });

  it("le manager aménage les locaux et attribue les postes mais ne gère ni les comptes ni la conformité", () => {
    expect(can("MANAGER", "layout:write")).toBe(true);
    expect(can("MANAGER", "workstation:assign")).toBe(true);
    expect(can("MANAGER", "stock:write")).toBe(true);
    expect(can("MANAGER", "users:manage")).toBe(false);
    expect(can("MANAGER", "org:settings")).toBe(false);
    expect(can("MANAGER", "audit:read")).toBe(false);
  });

  it("assertPermission lève ForbiddenError", () => {
    expect(() =>
      assertPermission({ role: "EMPLOYEE" }, "layout:write"),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertPermission({ role: "MANAGER" }, "layout:write"),
    ).not.toThrow();
  });
});
