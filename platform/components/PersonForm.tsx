import { TextInput, SelectField } from "@/components/ui/fields";
import { fr } from "@/lib/i18n/fr";

interface PersonFormFieldsProps {
  teams: Array<{ id: string; name: string }>;
  defaults?: {
    firstName?: string;
    lastName?: string;
    workEmail?: string;
    jobTitle?: string;
    teamId?: string | null;
  };
}

/** Champs d'un collaborateur : strictement ceux de SPEC §4, aucun champ libre. */
export default function PersonFormFields({
  teams,
  defaults,
}: PersonFormFieldsProps) {
  return (
    <>
      <TextInput
        id="firstName"
        label={fr.people.firstName}
        required
        maxLength={80}
        defaultValue={defaults?.firstName}
        autoComplete="off"
      />
      <TextInput
        id="lastName"
        label={fr.people.lastName}
        required
        maxLength={80}
        defaultValue={defaults?.lastName}
        autoComplete="off"
      />
      <TextInput
        id="workEmail"
        label={fr.people.workEmail}
        type="email"
        required
        maxLength={200}
        defaultValue={defaults?.workEmail}
        autoComplete="off"
      />
      <TextInput
        id="jobTitle"
        label={fr.people.jobTitle}
        required
        maxLength={120}
        defaultValue={defaults?.jobTitle}
      />
      <SelectField
        id="teamId"
        label={fr.people.team}
        placeholder={fr.common.noTeam}
        defaultValue={defaults?.teamId ?? ""}
        options={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
      <p className="text-xs text-slate-600">{fr.people.privacyNote}</p>
    </>
  );
}
