import { describe, expect, it } from "vitest";
import {
  inviteTemplate,
  resetPasswordTemplate,
  trialEndedTemplate,
  trialReminderTemplate,
  verifyEmailTemplate,
} from "@/lib/email/templates";
import { trialEmailDue, type TrialState } from "@/lib/db/trial-emails";

describe("gabarits d'e-mails", () => {
  const all = [
    verifyEmailTemplate({
      firstName: "Lina",
      url: "https://app.test/verifier-email?jeton=abc",
    }),
    resetPasswordTemplate({ url: "https://app.test/reinitialiser?jeton=abc" }),
    inviteTemplate({
      organization: "Agence <Horizon>",
      url: "https://app.test/invitation?jeton=abc",
    }),
    trialReminderTemplate({
      organization: "Agence",
      daysLeft: 3,
      url: "https://app.test/administration/abonnement",
    }),
    trialEndedTemplate({
      organization: "Agence",
      url: "https://app.test/administration/abonnement",
    }),
  ];

  it("ont un objet, une version texte et une version HTML contenant le lien", () => {
    for (const email of all) {
      expect(email.subject.length).toBeGreaterThan(5);
      expect(email.text).toMatch(/https:\/\/app\.test\//);
      expect(email.html).toMatch(/href="https:\/\/app\.test\//);
    }
  });

  it("n'embarquent ni image distante ni pixel de suivi", () => {
    for (const email of all) {
      expect(email.html).not.toMatch(/<img|<script|background-image|url\(/i);
    }
  });

  it("échappent les données affichées (pas d'injection HTML)", () => {
    const invite = all[2];
    expect(invite.html).toContain("Agence &lt;Horizon&gt;");
    expect(invite.html).not.toContain("<Horizon>");
  });
});

describe("rappels de fin d'essai", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const base: TrialState = {
    id: "o",
    name: "Agence",
    subscriptionStatus: "TRIALING",
    trialEndsAt: null,
    trialReminderSentAt: null,
    trialEndedNoticeAt: null,
  };
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

  it("rappel quand il reste 3 jours ou moins, une seule fois", () => {
    expect(trialEmailDue({ ...base, trialEndsAt: inDays(5) }, now)).toBeNull();
    expect(trialEmailDue({ ...base, trialEndsAt: inDays(2.5) }, now)).toBe(
      "reminder",
    );
    expect(
      trialEmailDue(
        { ...base, trialEndsAt: inDays(2.5), trialReminderSentAt: now },
        now,
      ),
    ).toBeNull();
  });

  it("avis de fin d'essai une fois l'essai terminé, une seule fois", () => {
    expect(trialEmailDue({ ...base, trialEndsAt: inDays(-1) }, now)).toBe(
      "ended",
    );
    expect(
      trialEmailDue(
        { ...base, trialEndsAt: inDays(-1), trialEndedNoticeAt: now },
        now,
      ),
    ).toBeNull();
  });

  it("rien pour un abonné", () => {
    expect(
      trialEmailDue(
        { ...base, subscriptionStatus: "ACTIVE", trialEndsAt: inDays(-1) },
        now,
      ),
    ).toBeNull();
  });
});
