"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Group,
  List,
  NumberInput,
  Radio,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { previewRecurrence, type MonthlyRecurrenceType, type RecurrenceFrequency, type RecurrenceRuleInput } from "@/lib/eventSeriesApi";

const WEEKDAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

const ORDINAL_POSITIONS = [
  { label: "First", value: "1" },
  { label: "Second", value: "2" },
  { label: "Third", value: "3" },
  { label: "Fourth", value: "4" },
  { label: "Last", value: "-1" },
];

export type RecurrenceFormValues = {
  frequency: RecurrenceFrequency;
  interval: number;
  by_weekday: number[];
  monthly_type: MonthlyRecurrenceType;
  by_month_day: number;
  ordinal_weekday: number;
  by_set_position: number;
  start_time: string;
  end_time: string;
  timezone: string;
  ends: "on_date" | "after_count";
  until: string;
  occurrence_count: number;
};

export const DEFAULT_RECURRENCE_VALUES: RecurrenceFormValues = {
  frequency: "WEEKLY",
  interval: 1,
  by_weekday: [5],
  monthly_type: "MONTH_DAY",
  by_month_day: 1,
  ordinal_weekday: 5,
  by_set_position: 1,
  start_time: "18:00",
  end_time: "21:00",
  timezone: "UTC",
  ends: "after_count",
  until: "",
  occurrence_count: 12,
};

/** Converts the form's UI-friendly shape into the API's RecurrenceRuleInput — the "ends" radio and split ordinal fields exist only client-side for a nicer form. */
export function toRecurrenceRuleInput(values: RecurrenceFormValues): RecurrenceRuleInput {
  return {
    frequency: values.frequency,
    interval: values.interval,
    ...(values.frequency === "WEEKLY" ? { by_weekday: values.by_weekday } : {}),
    ...(values.frequency === "MONTHLY"
      ? values.monthly_type === "MONTH_DAY"
        ? { monthly_type: "MONTH_DAY" as const, by_month_day: values.by_month_day }
        : { monthly_type: "ORDINAL_WEEKDAY" as const, by_weekday: [values.ordinal_weekday], by_set_position: values.by_set_position }
      : {}),
    start_time: values.start_time,
    end_time: values.end_time,
    timezone: values.timezone,
    ...(values.ends === "on_date" ? { until: values.until } : { occurrence_count: values.occurrence_count }),
  };
}

/**
 * The recurrence-schedule form + a live preview of resolved dates
 * (§11) — shared between the series creation wizard and the series
 * Recurrence settings tab. Frequency-specific fields (weekday
 * multi-select, monthly exact-date vs ordinal-weekday) match RFC 5545's
 * vocabulary (docs/13_recurring_events_prd.md §2) one-to-one.
 */
export function RecurrenceRuleEditor({
  values,
  onChange,
  startsOn,
  onStartsOnChange,
  disabled,
}: {
  values: RecurrenceFormValues;
  onChange: (values: RecurrenceFormValues) => void;
  startsOn: string;
  onStartsOnChange: (value: string) => void;
  disabled?: boolean;
}) {
  function set<K extends keyof RecurrenceFormValues>(key: K, value: RecurrenceFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  const [debounced, setDebounced] = useState({ values, startsOn });
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced({ values, startsOn }), 400);
    return () => clearTimeout(timeout);
  }, [values, startsOn]);

  const isValid = startsOn.length > 0 && (values.frequency !== "WEEKLY" || values.by_weekday.length > 0);
  const preview = useQuery({
    queryKey: ["recurrence-preview", debounced],
    queryFn: () => previewRecurrence({ starts_on: debounced.startsOn, recurrence: toRecurrenceRuleInput(debounced.values) }),
    enabled: isValid,
    retry: false,
  });

  return (
    <Stack gap="md">
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <Stack gap="md">
          <TextInput type="date" label="First occurrence" required value={startsOn} onChange={(e) => onStartsOnChange(e.currentTarget.value)} />

          <Group grow align="flex-end">
            <Select
              label="Repeats"
              data={[
                { value: "DAILY", label: "Daily" },
                { value: "WEEKLY", label: "Weekly" },
                { value: "MONTHLY", label: "Monthly" },
              ]}
              value={values.frequency}
              onChange={(v) => v && set("frequency", v as RecurrenceFrequency)}
              allowDeselect={false}
            />
            <NumberInput
              label={`Every ${values.interval === 1 ? "" : values.interval + " "}${
                { DAILY: "day(s)", WEEKLY: "week(s)", MONTHLY: "month(s)" }[values.frequency]
              }`}
              min={1}
              value={values.interval}
              onChange={(v) => set("interval", Number(v) || 1)}
            />
          </Group>

          {values.frequency === "WEEKLY" && (
            <div>
              <Text size="sm" fw={500} mb={4}>
                On these days
              </Text>
              <Group gap={6}>
                {WEEKDAYS.map((day) => (
                  <Button
                    key={day.value}
                    size="compact-sm"
                    variant={values.by_weekday.includes(day.value) ? "filled" : "default"}
                    onClick={() =>
                      set(
                        "by_weekday",
                        values.by_weekday.includes(day.value)
                          ? values.by_weekday.filter((d) => d !== day.value)
                          : [...values.by_weekday, day.value].sort(),
                      )
                    }
                  >
                    {day.label}
                  </Button>
                ))}
              </Group>
              {values.by_weekday.length === 0 && (
                <Text size="xs" c="red" mt={4}>
                  Select at least one day.
                </Text>
              )}
            </div>
          )}

          {values.frequency === "MONTHLY" && (
            <Stack gap="xs">
              <Radio.Group value={values.monthly_type} onChange={(v) => set("monthly_type", v as MonthlyRecurrenceType)}>
                <Stack gap="xs">
                  <Radio value="MONTH_DAY" label="On an exact date each month" />
                  {values.monthly_type === "MONTH_DAY" && (
                    <NumberInput
                      ml="xl" maw={160} label="Day of month" min={1} max={31}
                      value={values.by_month_day} onChange={(v) => set("by_month_day", Number(v) || 1)}
                      description="A month without this date is skipped, not shifted."
                    />
                  )}
                  <Radio value="ORDINAL_WEEKDAY" label="On a specific weekday each month" />
                  {values.monthly_type === "ORDINAL_WEEKDAY" && (
                    <Group ml="xl" gap="xs">
                      <Select
                        data={ORDINAL_POSITIONS} value={String(values.by_set_position)}
                        onChange={(v) => v && set("by_set_position", Number(v))}
                        allowDeselect={false} w={120}
                      />
                      <Select
                        data={WEEKDAYS.map((d) => ({ value: String(d.value), label: d.label }))}
                        value={String(values.ordinal_weekday)}
                        onChange={(v) => v && set("ordinal_weekday", Number(v))}
                        allowDeselect={false} w={100}
                      />
                    </Group>
                  )}
                </Stack>
              </Radio.Group>
            </Stack>
          )}

          <Group grow>
            <TextInput type="time" label="Start time" value={values.start_time} onChange={(e) => set("start_time", e.currentTarget.value)} />
            <TextInput type="time" label="End time" value={values.end_time} onChange={(e) => set("end_time", e.currentTarget.value)} />
          </Group>
          <TimezoneSelector label="Timezone" value={values.timezone} onChange={(v) => set("timezone", v ?? "UTC")} />

          <div>
            <Text size="sm" fw={500} mb={4}>
              Ends
            </Text>
            <SegmentedControl
              value={values.ends}
              onChange={(v) => set("ends", v as "on_date" | "after_count")}
              data={[
                { value: "after_count", label: "After a number of occurrences" },
                { value: "on_date", label: "On a date" },
              ]}
              fullWidth
            />
            {values.ends === "after_count" ? (
              <NumberInput mt="xs" maw={200} label="Number of occurrences" min={1} max={200} value={values.occurrence_count} onChange={(v) => set("occurrence_count", Number(v) || 1)} />
            ) : (
              <TextInput mt="xs" maw={200} type="date" label="Ends on" value={values.until} onChange={(e) => set("until", e.currentTarget.value)} />
            )}
          </div>
        </Stack>
      </fieldset>

      <div>
        <Title order={6} mb={4}>
          Preview
        </Title>
        {!isValid && <Text size="sm" c="dimmed">Fill in the schedule above to preview dates.</Text>}
        {preview.isFetching && <Text size="sm" c="dimmed">Calculating…</Text>}
        {preview.error && (
          <Alert color="red" variant="light">
            {preview.error instanceof Error ? preview.error.message : "Could not calculate this schedule."}
          </Alert>
        )}
        {preview.data && (
          <>
            <Text size="sm" c="dimmed" mb={4}>
              {preview.data.occurrences.length} occurrence{preview.data.occurrences.length === 1 ? "" : "s"} — next {Math.min(5, preview.data.occurrences.length)} shown below.
            </Text>
            <List size="sm" spacing={2}>
              {preview.data.occurrences.slice(0, 5).map((o) => (
                <List.Item key={o.sequence_number}>
                  {o.date}
                  {o.dst_shifted && (
                    <Text span c="orange" size="xs" ml={6}>
                      (shifted for daylight saving)
                    </Text>
                  )}
                </List.Item>
              ))}
            </List>
          </>
        )}
      </div>
    </Stack>
  );
}
