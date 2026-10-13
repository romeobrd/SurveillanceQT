// Boîte d'envoi locale du serveur de développement (.dev-emails/outbox.jsonl) : lecture des liens envoyés.
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";

interface OutboxEmail {
  to: string;
  subject: string;
  text: string;
}

function emailsTo(to: string): OutboxEmail[] {
  const file = path.join(
    process.env.EMAIL_OUTBOX_DIR ?? path.join(process.cwd(), ".dev-emails"),
    "outbox.jsonl",
  );
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxEmail)
    .filter((email) => email.to === to);
}

/** Dernier lien de l'application reçu par cette adresse dont le sujet correspond. */
export async function lastLinkTo(to: string, subject: RegExp): Promise<string> {
  let link = "";
  await expect
    .poll(() => {
      const email = emailsTo(to)
        .filter((candidate) => subject.test(candidate.subject))
        .at(-1);
      link =
        /https?:\/\/\S+jeton=[A-Za-z0-9_-]+/.exec(email?.text ?? "")?.[0] ?? "";
      return link;
    })
    .not.toBe("");
  // Chemin seul : le test reste sur le serveur qu'il pilote
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}
