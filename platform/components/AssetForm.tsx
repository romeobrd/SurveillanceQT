import { SelectField, TextInput } from "@/components/ui/fields";
import { ASSET_STATES } from "@/features/assets/schemas";
import { fr } from "@/lib/i18n/fr";

export default function AssetFields({
  people,
  zones,
  defaults,
}: {
  people: Array<{ id: string; firstName: string; lastName: string }>;
  zones: Array<{ id: string; name: string }>;
  defaults?: {
    type?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    state?: (typeof ASSET_STATES)[number];
    purchaseDate?: Date | null;
    personId?: string | null;
    zoneId?: string | null;
  };
}) {
  return (
    <>
      <TextInput
        id="type"
        label={fr.assets.type}
        required
        maxLength={60}
        defaultValue={defaults?.type}
      />
      <TextInput
        id="brand"
        label={fr.assets.brand}
        required
        maxLength={60}
        defaultValue={defaults?.brand}
      />
      <TextInput
        id="model"
        label={fr.assets.model}
        required
        maxLength={80}
        defaultValue={defaults?.model}
      />
      <TextInput
        id="serialNumber"
        label={fr.assets.serialNumber}
        required
        maxLength={80}
        defaultValue={defaults?.serialNumber}
      />
      <SelectField
        id="state"
        label={fr.assets.state}
        defaultValue={defaults?.state ?? "IN_SERVICE"}
        options={ASSET_STATES.map((state) => ({
          value: state,
          label: fr.assets.states[state],
        }))}
      />
      <TextInput
        id="purchaseDate"
        label={fr.assets.purchaseDate}
        type="date"
        defaultValue={
          defaults?.purchaseDate
            ? defaults.purchaseDate.toISOString().slice(0, 10)
            : ""
        }
      />
      <SelectField
        id="personId"
        label={fr.assets.person}
        placeholder={fr.assets.unassigned}
        defaultValue={defaults?.personId ?? ""}
        options={people.map((person) => ({
          value: person.id,
          label: `${person.lastName} ${person.firstName}`,
        }))}
      />
      <SelectField
        id="zoneId"
        label={fr.assets.zone}
        placeholder={fr.common.noZone}
        defaultValue={defaults?.zoneId ?? ""}
        options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
      />
    </>
  );
}
