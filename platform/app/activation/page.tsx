import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import ActivationForm from "@/components/desktop/ActivationForm";
import { localOrganizationExists } from "@/lib/db/desktop-local";
import { accountServerUrl, currentLicence } from "@/lib/desktop/licence-store";
import { edition } from "@/lib/edition";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.desktop.activationTitle} — ${fr.app.name}`,
};

const t = fr.desktop;
const REASONS = [
  "no_subscription",
  "revoked",
  "offline_expired",
  "clock",
  "invalid",
  "unconfigured",
] as const;

async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (edition() !== "desktop") notFound();
  // Licence déjà valide : étape suivante
  const licence = await currentLicence();
  if (licence.state === "valid")
    redirect((await localOrganizationExists()) ? "/login" : "/demarrage");
  const raw = (await searchParams).raison;
  const reason = REASONS.find((value) => value === raw);
  return (
    <>
      {reason && (
        <p
          role="alert"
          className="w-full max-w-sm rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {t.reasons[reason]}
        </p>
      )}
      <ActivationForm accountUrl={accountServerUrl()} />
      <p className="text-xs text-slate-500">
        {t.server.replace("{url}", accountServerUrl())}
      </p>
    </>
  );
}

export default function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <span
          aria-hidden="true"
          className="bg-brand-600 mb-2 inline-block h-8 w-8 rotate-45 rounded-md"
        />
        <h1 className="text-2xl font-semibold">{t.activationTitle}</h1>
        <p className="text-sm text-slate-600">{t.activationIntro}</p>
      </div>
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
