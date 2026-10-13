import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { emailMode, readOutbox } from "@/lib/email/send";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: fr.email.devOutboxTitle };

/** Rend les liens d'un e-mail cliquables (texte brut, jamais de HTML injecté). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            className="text-brand-700 break-all underline"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

async function Outbox() {
  await connection();
  // Uniquement en développement : la page n'existe pas en production
  if (emailMode() !== "outbox") notFound();
  const emails = await readOutbox();
  return emails.length === 0 ? (
    <p className="text-slate-600">{fr.email.devOutboxEmpty}</p>
  ) : (
    <ul className="flex flex-col gap-4">
      {emails.map((email, index) => (
        <li
          key={`${email.sentAt}-${index}`}
          data-testid="dev-email"
          className="rounded-lg border border-slate-200 p-4"
        >
          <p className="text-xs text-slate-500">
            {email.sentAt} · <span data-testid="dev-email-to">{email.to}</span>
          </p>
          <p className="font-semibold" data-testid="dev-email-subject">
            {email.subject}
          </p>
          <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">
            <Linkified text={email.text} />
          </pre>
        </li>
      ))}
    </ul>
  );
}

export default function DevEmailsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">{fr.email.devOutboxTitle}</h1>
      <p className="mb-4 text-sm text-slate-600">{fr.email.devOutboxHelp}</p>
      <Suspense fallback={null}>
        <Outbox />
      </Suspense>
    </main>
  );
}
