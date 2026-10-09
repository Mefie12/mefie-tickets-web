"use client";

import { NumberInput, Select, Stack, Text } from "@mantine/core";
import { DOORS_PRESETS } from "@/lib/venueApi";
import { CUSTOM_DOORS, doorsClockTime, doorsMinutesFromChoice, doorsMinutesInvalid, doorsPresetLabel, type DoorsChoice } from "@/lib/doorsOpen";

/**
 * "Doors open" as a gap before the start (docs/25), with a live clock-time preview. It is one value on the
 * event, so every place that shows this control edits the same field. `startAt` is the wall-clock start in the
 * event's own zone (`YYYY-MM-DDTHH:mm`); leave it empty when the start isn't known and the preview is skipped.
 */
export function DoorsOpenField({
  value, onChange, startAt, disabled, hint = true,
}: {
  value: DoorsChoice;
  onChange: (next: DoorsChoice) => void;
  startAt?: string;
  disabled?: boolean;
  hint?: boolean;
}) {
  const minutes = doorsMinutesFromChoice(value);
  const invalid = doorsMinutesInvalid(minutes);
  const preview = startAt ? doorsClockTime(startAt, minutes) : null;

  return (
    <Stack gap={6}>
      <Select
        label="Doors open"
        placeholder="Not set"
        clearable
        clearButtonProps={{ "aria-label": "Clear doors time" }}
        disabled={disabled}
        data={[...DOORS_PRESETS.map((m) => ({ value: String(m), label: doorsPresetLabel(m) })), { value: CUSTOM_DOORS, label: "Custom…" }]}
        value={value.choice === "" ? null : value.choice}
        onChange={(choice) => onChange({ ...value, choice: choice ?? "" })}
      />
      {value.choice === CUSTOM_DOORS && (
        <NumberInput
          label="Minutes before start"
          min={1}
          max={1440}
          allowDecimal={false}
          disabled={disabled}
          value={value.custom}
          onChange={(custom) => onChange({ ...value, custom })}
          error={invalid ? "Enter 1 to 1440 minutes" : undefined}
        />
      )}
      {preview && <Text size="sm" fw={500}>Doors open at {preview.time}{preview.previousDay ? " the day before" : ""}</Text>}
      {hint && <Text size="xs" c="dimmed">Set as a time before the start, so it moves with the event if you change the start time. Shown to venue agents.</Text>}
    </Stack>
  );
}
