// Licence de l'application de bureau : contrôle toutes les 12 h, 14 jours hors ligne, blocage si arrêtée,
// horloge remise en arrière refusée.
import { describe, expect, it } from "vitest";
import type { LicenceGrant } from "@/lib/desktop/licence-grant";
import {
  licenceState,
  needsVerification,
  nextSeenAt,
  offlineDaysLeft,
} from "@/lib/desktop/licence-policy";
import type { StoredLicence } from "@/lib/desktop/licence-types";

const now = new Date("2026-10-14T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const grant = (hoursAgo: number): LicenceGrant => {
  const issuedAt = now.getTime() - hoursAgo * HOUR;
  return {
    userId: "u",
    issuedAt,
    expiresAt: issuedAt + 14 * DAY,
    licence: {
      organizationId: "o",
      organizationName: "Cabinet",
      plan: "pro",
      planName: "Pro",
      maxPeople: 50,
      validUntil: null,
      admin: { email: "a@b.fr", firstName: "A", lastName: "B" },
    },
  };
};
const stored = (
  status: StoredLicence["status"] = "active",
  seenAt: Date = now,
): StoredLicence => ({ grant: "x.y", status, seenAt: seenAt.toISOString() });

describe("politique de licence", () => {
  it("sans licence : activation ; signature fausse : invalide ; arrêtée : bloquée", () => {
    expect(licenceState(null, null, now)).toEqual({ state: "missing" });
    expect(licenceState(stored(), null, now)).toEqual({ state: "invalid" });
    expect(licenceState(stored("no_subscription"), grant(1), now)).toEqual({
      state: "inactive",
      reason: "no_subscription",
    });
  });

  it("recontacte le serveur après 12 h, tolère 14 jours sans réseau (date signée)", () => {
    expect(needsVerification(grant(11), now)).toBe(false);
    expect(needsVerification(grant(12), now)).toBe(true);
    expect(licenceState(stored(), grant(13 * 24), now).state).toBe("valid");
    expect(offlineDaysLeft(grant(13 * 24), now)).toBe(1);
    expect(licenceState(stored(), grant(15 * 24), now).state).toBe(
      "offline_expired",
    );
  });

  it("refuse une horloge remise avant l'émission de la licence ou avant une date déjà constatée", () => {
    // Licence émise demain selon le serveur : l'horloge du PC a reculé
    expect(licenceState(stored(), grant(-24), now).state).toBe("clock");
    // Léger décalage avec le serveur : toléré
    expect(licenceState(stored(), grant(-0.05), now).state).toBe("valid");
    // Date déjà constatée dans 3 jours : l'horloge a été remise en arrière
    expect(
      licenceState(
        stored("active", new Date(now.getTime() + 3 * DAY)),
        grant(1),
        now,
      ).state,
    ).toBe("clock");
    expect(
      licenceState(
        stored("active", new Date(now.getTime() + HOUR / 2)),
        grant(1),
        now,
      ).state,
    ).toBe("valid");
  });

  it("n'enregistre la date constatée qu'une fois par heure au plus", () => {
    expect(nextSeenAt(stored("active", now), now)).toBeNull();
    expect(
      nextSeenAt(stored("active", new Date(now.getTime() - 2 * HOUR)), now),
    ).toBe(now.toISOString());
  });
});
