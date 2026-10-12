import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/security/csp";

describe("CSP", () => {
  const csp = buildCsp();
  const directive = (name: string) =>
    csp
      .split("; ")
      .find((part) => part.startsWith(`${name} `) || part === name);

  it("n'autorise que l'origine de l'application (aucun tiers)", () => {
    expect(csp).not.toMatch(/https?:\/\//);
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("connect-src")).toBe("connect-src 'self'");
    expect(directive("font-src")).toBe("font-src 'self'");
  });

  it("n'autorise unsafe-eval qu'en développement", () => {
    expect(directive("script-src")).not.toContain("unsafe-eval");
    expect(buildCsp({ dev: true })).toContain("'unsafe-eval'");
    expect(buildCsp({ dev: true })).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("interdit les objets, les cadres et le détournement de formulaires", () => {
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'self'");
  });
});
