import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import EmailLinkPage from "@/components/EmailLinkPage";
import { ForgotPasswordForm } from "@/components/EmailLinkForms";
import { emailAvailable } from "@/lib/email/send";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.email.forgotTitle} — ${fr.app.name}`,
};

async function Form() {
  await connection();
  return <ForgotPasswordForm available={emailAvailable()} />;
}

export default function ForgotPasswordPage() {
  return (
    <EmailLinkPage title={fr.email.forgotTitle}>
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </EmailLinkPage>
  );
}
