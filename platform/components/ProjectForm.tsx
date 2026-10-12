import { SelectField, TextArea, TextInput } from "@/components/ui/fields";
import { fr } from "@/lib/i18n/fr";

export default function ProjectFields({
  teams,
  defaults,
}: {
  teams: Array<{ id: string; name: string }>;
  defaults?: { name?: string; description?: string; teamId?: string | null };
}) {
  return (
    <>
      <TextInput
        id="name"
        label={fr.projects.name}
        required
        maxLength={120}
        defaultValue={defaults?.name}
      />
      <SelectField
        id="teamId"
        label={fr.projects.team}
        placeholder={fr.common.noTeam}
        defaultValue={defaults?.teamId ?? ""}
        options={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
      <TextArea
        id="description"
        label={fr.projects.description}
        maxLength={500}
        defaultValue={defaults?.description}
      />
    </>
  );
}
