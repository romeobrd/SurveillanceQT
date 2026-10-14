import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import SetupForm from "@/components/desktop/SetupForm";
import { localOrganizationExists } from "@/lib/db/desktop-local";
import { currentLicence } from "@/lib/desktop/licence-store";
import { edition } from "@/lib/edition";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.desktop.setupTitle} — ${fr.app.name}`,
};

const t = fr.desktop;

async function Content() {
  await connection();
  if (edition() !== "desktop") notFound();
  const licence = await currentLicence();
  if (licence.state !== "valid") redirect("/activation");
  if (await localOrganizationExists()) redirect("/login");
  const { licence: info } = licence.stored;
  return (
    <>
      <p className="text-sm text-slate-700" data-testid="setup-plan">
        {t.plan
          .replace("{plan}", info.planName)
          .replace("{max}", String(info.maxPeople))}
      </p>
      {/* Préremplie avec le compte client (modifiable) */}
      <SetupForm
        initial={{
          company: info.organizationName,
          firstName: info.admin.firstName,
          lastName: info.admin.lastName,
          email: info.admin.email,
        }}
      />
    </>
  );
}

export default function SetupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <span
          aria-hidden="true"
          className="bg-brand-600 mb-2 inline-block h-8 w-8 rotate-45 rounded-md"
        />
        <h1 className="text-2xl font-semibold">{t.setupTitle}</h1>
        <p className="text-sm text-slate-600">{t.setupIntro}</p>
      </div>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </main>
  );
}
