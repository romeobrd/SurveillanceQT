import type { Metadata } from "next";
import { changePasswordAction } from "./actions";
import ActionForm from "@/components/ui/ActionForm";
import { TextInput } from "@/components/ui/fields";
import { Card } from "@/components/ui/layout";
import { requireSessionAllowingPasswordChange } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.myAccount.title} — ${fr.app.name}`,
};

const t = fr.myAccount;

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Page accessible même avec un mot de passe provisoire : c'est ici qu'on le change
  const session = await requireSessionAllowingPasswordChange();
  const done = (await searchParams).ok === "1" && !session.mustChangePassword;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      {session.mustChangePassword && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {t.mustChange}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          {t.done}
        </p>
      )}
      <Card title={t.changeTitle}>
        <p className="mb-3 text-sm text-slate-700">{t.help}</p>
        <ActionForm action={changePasswordAction} submitLabel={t.submit}>
          <TextInput
            id="current"
            label={t.current}
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
          />
          <TextInput
            id="next"
            label={t.next}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={200}
          />
          <TextInput
            id="confirm"
            label={t.confirm}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={200}
          />
        </ActionForm>
      </Card>
    </div>
  );
}
