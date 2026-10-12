import { describe, expect, it } from "vitest";
import { checkCronAuthorization } from "@/lib/security/cron-auth";

const secret = "s".repeat(40);

describe("authentification de la tâche planifiée", () => {
  it("accepte le bon secret", () => {
    expect(checkCronAuthorization(`Bearer ${secret}`, secret)).toBe("ok");
  });

  it("refuse un secret absent, faux ou mal formé", () => {
    expect(checkCronAuthorization(null, secret)).toBe("unauthorized");
    expect(checkCronAuthorization("", secret)).toBe("unauthorized");
    expect(checkCronAuthorization(`Bearer ${"x".repeat(40)}`, secret)).toBe(
      "unauthorized",
    );
    expect(checkCronAuthorization(`Bearer ${secret}x`, secret)).toBe(
      "unauthorized",
    );
    expect(checkCronAuthorization(secret, secret)).toBe("unauthorized"); // sans « Bearer »
    expect(checkCronAuthorization(`bearer ${secret}`, secret)).toBe(
      "unauthorized",
    );
  });

  it("reste fermée tant qu'aucun secret solide n'est configuré", () => {
    expect(checkCronAuthorization(`Bearer ${secret}`, undefined)).toBe(
      "not_configured",
    );
    expect(checkCronAuthorization("Bearer court", "court")).toBe(
      "not_configured",
    );
    expect(checkCronAuthorization("Bearer ", "")).toBe("not_configured");
  });
});
