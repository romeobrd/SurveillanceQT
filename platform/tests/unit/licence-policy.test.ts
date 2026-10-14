// Licence de l'application de bureau : contrôle toutes les 12 h, 14 jours hors ligne, blocage si arrêtée.
import { describe, expect, it } from "vitest";
import {
  licenceState,
  needsVerification,
  offlineDaysLeft,
} from "@/lib/desktop/licence-policy";
import type { StoredLicence } from "@/lib/desktop/licence-types";

const now = new Date("2026-10-14T12:00:00Z");
const stored = (
  hoursAgo: number,
  status: StoredLicence["status"] = "active",
): StoredLicence => ({
  token: "t",
  status,
  lastVerifiedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  licence: {
    organizationId: "o",
    organizationName: "Cabinet",
    plan: "pro",
    planName: "Pro",
    maxPeople: 50,
    validUntil: null,
    admin: { email: "a@b.fr", firstName: "A", lastName: "B" },
  },
});

describe("politique de licence", () => {
  it("sans licence : activation ; arrêtée : bloquée", () => {
    expect(licenceState(null, now)).toEqual({ state: "missing" });
    expect(licenceState(stored(1, "no_subscription"), now)).toEqual({
      state: "inactive",
      reason: "no_subscription",
    });
  });

  it("recontacte le serveur après 12 h, tolère 14 jours sans réseau", () => {
    expect(needsVerification(stored(11), now)).toBe(false);
    expect(needsVerification(stored(12), now)).toBe(true);
    expect(licenceState(stored(13 * 24), now).state).toBe("valid");
    expect(offlineDaysLeft(stored(13 * 24), now)).toBe(1);
    expect(licenceState(stored(15 * 24), now).state).toBe("offline_expired");
  });
});
