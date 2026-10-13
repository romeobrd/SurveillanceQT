import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import EmailLinkPage from "@/components/EmailLinkPage";
import { SetPasswordForm } from "@/components/EmailLinkForms";
import { isTokenValid } from "@/lib/db/email-flows";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.email.inviteTitle} — ${fr.app.name}`,
};

async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).jeton;
  const token = typeof raw === "string" ? raw : "";
  // Lien vérifié sans être consommé : il ne l'est qu'à l'envoi du formulaire
  if (!(await isTokenValid(token, "INVITE")))
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p
          role="alert"
          data-testid="link-error"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {fr.email.invalidLink}
        </p>
        <Link href="/login" className="text-center text-sm underline">
          {fr.email.backToLogin}
        </Link>
      </div>
    );
  return <SetPasswordForm token={token} mode="invite" />;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <EmailLinkPage title={fr.email.inviteTitle}>
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </EmailLinkPage>
  );
}
