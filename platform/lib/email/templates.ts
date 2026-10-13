// Gabarits des e-mails : fonctions pures, testées. Sobres, en français, sans image distante ni pixel de suivi.
import { fr } from "@/lib/i18n/fr";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mise en page commune : un titre, des paragraphes, un bouton, et le lien en clair (si le bouton est bloqué). */
function layout(input: {
  subject: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
}): EmailContent {
  const name = fr.app.name;
  const footer =
    input.footer ??
    `Cet e-mail vous est envoyé par ${name} dans le cadre de votre compte. Il ne contient aucun traceur.`;
  const text = [
    input.title,
    "",
    ...input.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(input.action
      ? [`${input.action.label} : ${input.action.url}`, ""]
      : []),
    "—",
    footer,
  ].join("\n");
  const button = input.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.action.url)}" style="background:#ea580c;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(input.action.label)}</a></p>
<p style="font-size:12px;color:#64748b">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(input.action.url)}</p>`
    : "";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:700;font-size:18px;margin:0 0 16px">${escapeHtml(name)}</p>
<div style="background:#ffffff;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(input.title)}</h1>
${input.paragraphs.map((paragraph) => `<p style="line-height:1.5">${escapeHtml(paragraph)}</p>`).join("\n")}
${button}
</div>
<p style="font-size:12px;color:#64748b;margin-top:16px">${escapeHtml(footer)}</p>
</div></body></html>`;
  return { subject: input.subject, text, html };
}

export function verifyEmailTemplate(input: {
  firstName: string;
  url: string;
}): EmailContent {
  return layout({
    subject: `Confirmez votre adresse e-mail — ${fr.app.name}`,
    title: `Bienvenue, ${input.firstName} !`,
    paragraphs: [
      "Votre espace est prêt. Confirmez votre adresse e-mail pour sécuriser votre compte et pouvoir souscrire un abonnement.",
      "Ce lien est valable 48 heures.",
    ],
    action: { label: "Confirmer mon adresse", url: input.url },
  });
}

export function resetPasswordTemplate(input: { url: string }): EmailContent {
  return layout({
    subject: `Réinitialisation de votre mot de passe — ${fr.app.name}`,
    title: "Choisir un nouveau mot de passe",
    paragraphs: [
      "Une demande de réinitialisation du mot de passe a été faite pour votre compte.",
      "Ce lien est valable 1 heure et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
    ],
    action: { label: "Choisir un nouveau mot de passe", url: input.url },
  });
}

export function inviteTemplate(input: {
  organization: string;
  url: string;
}): EmailContent {
  return layout({
    subject: `Invitation à rejoindre ${input.organization} sur ${fr.app.name}`,
    title: `Vous êtes invité(e) sur ${fr.app.name}`,
    paragraphs: [
      `${input.organization} vous invite à utiliser ${fr.app.name}, l'outil de gestion des locaux, des postes, du stock et des projets de l'entreprise.`,
      "Choisissez votre mot de passe pour activer votre compte. Ce lien est valable 7 jours.",
    ],
    action: { label: "Activer mon compte", url: input.url },
  });
}

export function trialReminderTemplate(input: {
  organization: string;
  daysLeft: number;
  url: string;
}): EmailContent {
  return layout({
    subject: `Votre essai se termine dans ${input.daysLeft} jour(s) — ${fr.app.name}`,
    title: "Votre essai gratuit touche à sa fin",
    paragraphs: [
      `L'essai de ${input.organization} se termine dans ${input.daysLeft} jour(s).`,
      "Choisissez une offre pour continuer sans interruption. Sans abonnement, vos données restent consultables et exportables, mais ne sont plus modifiables.",
    ],
    action: { label: "Choisir une offre", url: input.url },
  });
}

export function trialEndedTemplate(input: {
  organization: string;
  url: string;
}): EmailContent {
  return layout({
    subject: `Votre essai est terminé — ${fr.app.name}`,
    title: "Votre essai gratuit est terminé",
    paragraphs: [
      `L'espace de ${input.organization} est passé en lecture seule : vos données restent consultables et exportables.`,
      "Choisissez une offre pour reprendre là où vous en étiez.",
    ],
    action: { label: "Choisir une offre", url: input.url },
  });
}
