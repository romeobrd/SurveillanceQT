// Rappels de fin d'essai envoyés aux administrateurs par la tâche nocturne : un seul envoi de chaque.
import "server-only";
import { appBaseUrl, emailAvailable, sendEmail } from "@/lib/email/send";
import {
  trialEndedTemplate,
  trialReminderTemplate,
} from "@/lib/email/templates";
import { rawPrisma } from "./client";

/** Le rappel part quand il reste au plus ce nombre de jours d'essai. */
export const TRIAL_REMINDER_DAYS = 3;

export interface TrialState {
  id: string;
  name: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  trialReminderSentAt: Date | null;
  trialEndedNoticeAt: Date | null;
}

/** Quel e-mail envoyer maintenant (fonction pure) ? */
export function trialEmailDue(
  organization: TrialState,
  now: Date,
): "reminder" | "ended" | null {
  if (
    organization.subscriptionStatus !== "TRIALING" ||
    !organization.trialEndsAt
  )
    return null;
  const msLeft = organization.trialEndsAt.getTime() - now.getTime();
  if (msLeft <= 0) return organization.trialEndedNoticeAt ? null : "ended";
  if (
    msLeft <= TRIAL_REMINDER_DAYS * 86_400_000 &&
    !organization.trialReminderSentAt
  )
    return "reminder";
  return null;
}

/** Envoie le rappel dû à tous les administrateurs actifs ; renvoie le nombre d'e-mails envoyés. */
export async function sendTrialEmails(
  organization: TrialState,
  now: Date = new Date(),
): Promise<number> {
  if (!emailAvailable()) return 0;
  const due = trialEmailDue(organization, now);
  if (!due) return 0;
  const admins = await rawPrisma.user.findMany({
    where: {
      organizationId: organization.id,
      role: "ADMIN",
      disabledAt: null,
    },
    select: { email: true },
  });
  const url = `${appBaseUrl()}/administration/abonnement`;
  const content =
    due === "reminder"
      ? trialReminderTemplate({
          organization: organization.name,
          daysLeft: Math.max(
            1,
            Math.ceil(
              ((organization.trialEndsAt as Date).getTime() - now.getTime()) /
                86_400_000,
            ),
          ),
          url,
        })
      : trialEndedTemplate({ organization: organization.name, url });
  for (const admin of admins) await sendEmail(admin.email, content);
  await rawPrisma.organization.update({
    where: { id: organization.id },
    data:
      due === "reminder"
        ? { trialReminderSentAt: now }
        : { trialEndedNoticeAt: now },
  });
  return admins.length;
}
