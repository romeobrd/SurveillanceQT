import { describe, expect, it } from "vitest";
import {
  OrganizationSettingsSchema,
  RETENTION,
  retentionCutoff,
  todayInParis,
} from "@/lib/privacy/retention";

const valid = {
  presenceEnabled: "on",
  auditRetentionDays: "365",
  privacyRequestRetentionDays: "1095",
  departedPersonRetentionDays: "30",
};

describe("réglages de conservation", () => {
  it("accepte des valeurs valides venant d'un formulaire (case à cocher, nombres en texte)", () => {
    expect(OrganizationSettingsSchema.parse(valid)).toEqual({
      presenceEnabled: true,
      auditRetentionDays: 365,
      privacyRequestRetentionDays: 1095,
      departedPersonRetentionDays: 30,
    });
    expect(
      OrganizationSettingsSchema.parse({ ...valid, presenceEnabled: undefined })
        .presenceEnabled,
    ).toBe(false);
  });

  it("refuse les durées hors bornes ou non entières", () => {
    for (const [key, range] of Object.entries(RETENTION)) {
      expect(
        OrganizationSettingsSchema.safeParse({
          ...valid,
          [key]: String(range.min - 1),
        }).success,
      ).toBe(false);
      expect(
        OrganizationSettingsSchema.safeParse({
          ...valid,
          [key]: String(range.max + 1),
        }).success,
      ).toBe(false);
      expect(
        OrganizationSettingsSchema.safeParse({
          ...valid,
          [key]: String(range.min),
        }).success,
      ).toBe(true);
      expect(
        OrganizationSettingsSchema.safeParse({
          ...valid,
          [key]: String(range.max),
        }).success,
      ).toBe(true);
    }
    expect(
      OrganizationSettingsSchema.safeParse({
        ...valid,
        auditRetentionDays: "12.5",
      }).success,
    ).toBe(false);
    expect(
      OrganizationSettingsSchema.safeParse({
        ...valid,
        auditRetentionDays: "abc",
      }).success,
    ).toBe(false);
  });

  it("les valeurs par défaut sont dans les bornes", () => {
    for (const range of Object.values(RETENTION)) {
      expect(range.default).toBeGreaterThanOrEqual(range.min);
      expect(range.default).toBeLessThanOrEqual(range.max);
    }
  });
});

describe("dates de purge", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("calcule la date limite de conservation", () => {
    expect(retentionCutoff(now, 30).toISOString()).toBe(
      "2026-05-16T12:00:00.000Z",
    );
    expect(retentionCutoff(now, 0).toISOString()).toBe(now.toISOString());
  });

  it("détermine « aujourd'hui » en heure de Paris, été comme hiver", () => {
    expect(todayInParis(new Date("2026-01-15T22:59:00Z")).toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    ); // 23h59 à Paris
    expect(todayInParis(new Date("2026-01-15T23:00:00Z")).toISOString()).toBe(
      "2026-01-16T00:00:00.000Z",
    ); // minuit à Paris
    expect(todayInParis(new Date("2026-07-15T21:59:00Z")).toISOString()).toBe(
      "2026-07-15T00:00:00.000Z",
    );
    expect(todayInParis(new Date("2026-07-15T22:00:00Z")).toISOString()).toBe(
      "2026-07-16T00:00:00.000Z",
    );
  });

  it("gère le passage à l'heure d'été", () => {
    expect(todayInParis(new Date("2026-03-28T23:30:00Z")).toISOString()).toBe(
      "2026-03-29T00:00:00.000Z",
    );
    expect(todayInParis(new Date("2026-03-29T21:59:00Z")).toISOString()).toBe(
      "2026-03-29T00:00:00.000Z",
    );
    expect(todayInParis(new Date("2026-03-29T22:00:00Z")).toISOString()).toBe(
      "2026-03-30T00:00:00.000Z",
    );
  });
});
