// Envoi des e-mails : SMTP standard (tout prestataire européen : Brevo, Mailjet, Scaleway…).
// En développement sans SMTP, les e-mails sont écrits dans une boîte locale (.dev-emails) et JAMAIS envoyés.
import "server-only";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailContent } from "./templates";

export type EmailMode = "smtp" | "outbox" | "disabled";

export function emailMode(): EmailMode {
  if (process.env.SMTP_HOST) return "smtp";
  return process.env.NODE_ENV === "production" ? "disabled" : "outbox";
}

/** Les e-mails peuvent-ils partir (SMTP configuré, ou boîte locale en développement) ? */
export function emailAvailable(): boolean {
  return emailMode() !== "disabled";
}

/** Dossier de la boîte locale (EMAIL_OUTBOX_DIR permet aux tests d'utiliser leur propre dossier). */
function outboxDir(): string {
  return (
    process.env.EMAIL_OUTBOX_DIR ?? path.join(process.cwd(), ".dev-emails")
  );
}
const outboxFile = () => path.join(outboxDir(), "outbox.jsonl");

export interface OutboxEmail extends EmailContent {
  to: string;
  sentAt: string;
}

let transporter: Transporter | undefined;

export async function sendEmail(
  to: string,
  content: EmailContent,
): Promise<void> {
  const mode = emailMode();
  if (mode === "disabled")
    throw new Error("Envoi d'e-mails non configuré (SMTP_HOST)");
  if (mode === "outbox") {
    await mkdir(outboxDir(), { recursive: true });
    const entry: OutboxEmail = {
      to,
      ...content,
      sentAt: new Date().toISOString(),
    };
    await appendFile(outboxFile(), `${JSON.stringify(entry)}\n`, "utf8");
    return;
  }
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "no-reply@localhost",
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

/** Boîte locale de développement : les derniers e-mails en premier. */
export async function readOutbox(): Promise<OutboxEmail[]> {
  if (emailMode() !== "outbox") return [];
  try {
    const lines = (await readFile(outboxFile(), "utf8")).trim().split("\n");
    return lines
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OutboxEmail)
      .reverse();
  } catch {
    return [];
  }
}

/** Adresse publique de l'application pour les liens des e-mails (AUTH_URL en production). */
export function appBaseUrl(): string {
  const configured = process.env.AUTH_URL;
  return configured ? new URL(configured).origin : "http://localhost:3000";
}
