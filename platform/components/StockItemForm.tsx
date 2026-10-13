import { SelectField, TextInput } from "@/components/ui/fields";
import { fr } from "@/lib/i18n/fr";

export default function StockItemFields({
  zones,
  defaults,
}: {
  zones: Array<{ id: string; name: string }>;
  defaults?: {
    name?: string;
    reference?: string;
    unit?: string;
    threshold?: number;
    zoneId?: string | null;
  };
}) {
  return (
    <>
      <TextInput
        id="name"
        label={fr.stock.name}
        required
        maxLength={120}
        defaultValue={defaults?.name}
      />
      <TextInput
        id="reference"
        label={fr.stock.reference}
        required
        maxLength={60}
        defaultValue={defaults?.reference}
      />
      <TextInput
        id="unit"
        label={fr.stock.unit}
        required
        maxLength={20}
        defaultValue={defaults?.unit ?? "unités"}
      />
      <TextInput
        id="threshold"
        label={fr.stock.threshold}
        type="number"
        min={0}
        step={1}
        required
        defaultValue={defaults?.threshold ?? 0}
      />
      <SelectField
        id="zoneId"
        label={fr.common.zone}
        placeholder={fr.common.noZone}
        defaultValue={defaults?.zoneId ?? ""}
        options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
      />
    </>
  );
}
