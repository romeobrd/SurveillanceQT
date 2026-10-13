import { describe, expect, it } from "vitest";
import { fr } from "@/lib/i18n/fr";

describe("textes d'interface", () => {
  it("expose le nom de l'application", () => {
    expect(fr.app.name).toBe("Gestion d'entreprise");
  });
});
