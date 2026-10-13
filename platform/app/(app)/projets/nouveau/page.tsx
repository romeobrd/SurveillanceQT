import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createProjectAction } from "../actions";
import ProjectFields from "@/components/ProjectForm";
import ActionForm from "@/components/ui/ActionForm";
import { secondaryLink } from "@/components/ui/layout";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `${fr.projects.new} — ${fr.app.name}`,
};

export default async function NewProjectPage() {
  const { session, repos } = await getAppContext();
  if (!can(session.role, "project:write")) redirect("/projets");
  const teams = await repos.teams.list();
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{fr.projects.new}</h1>
      <ActionForm action={createProjectAction} submitLabel={fr.common.create}>
        <ProjectFields teams={teams} />
      </ActionForm>
      <p className="mt-4">
        <Link href="/projets" className={secondaryLink}>
          {fr.common.back}
        </Link>
      </p>
    </div>
  );
}
