"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, Select, Text } from "@mantine/core";
import type { ComboboxItem, ComboboxParsedItem } from "@mantine/core";
import { getTimezones, offsetLabelFor } from "@/lib/timezones";

/**
 * The one timezone picker in the app. Stores a canonical IANA identifier
 * ("Europe/London") — never a bare UTC offset, which can't express DST
 * rules and is exactly what the event scheduling model needs.
 *
 * Same drop-in prop shape as CountrySelector, so
 * `<TimezoneSelector {...form.getInputProps("timezone")} />` works with
 * no other changes to a form's useForm setup.
 */
export function TimezoneSelector({
  value,
  onChange,
  error,
  label,
  placeholder = "Select a timezone",
  required,
  disabled,
  description,
  "aria-label": ariaLabel,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  error?: React.ReactNode;
  label?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  description?: React.ReactNode;
  "aria-label"?: string;
}) {
  const timezones = useMemo(() => getTimezones(), []);
  const byId = useMemo(() => new Map(timezones.map((tz) => [tz.id, tz])), [timezones]);

  // Mantine renders an EMPTY input when `value` isn't present in `data`,
  // so an event stored with a zone this runtime doesn't enumerate would
  // silently look blank. Union it in rather than losing it.
  const data: ComboboxItem[] = useMemo(() => {
    const options = timezones.map((tz) => ({ value: tz.id, label: tz.id }));
    if (value && !byId.has(value)) {
      options.unshift({ value, label: value });
    }
    return options;
  }, [timezones, byId, value]);

  // `shortOffset` formatting genuinely differs between server (Node's
  // ICU) and client (the browser's) — e.g. UTC renders "GMT" in Node but
  // "GMT+0" in Chromium, for the identical Intl call. Since that's a
  // real runtime discrepancy rather than a value that's merely computed
  // late, the fix is to not render it during SSR at all — compute it
  // only after mount, same reasoning as browserTimezone() never running
  // at render/module scope.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const selectedOffset = mounted && value ? (byId.get(value)?.offsetLabel ?? offsetLabelFor(value)) : "";

  return (
    <Select
      label={label}
      description={description}
      aria-label={!label ? (ariaLabel ?? "Timezone") : ariaLabel}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      error={error}
      value={value ?? null}
      onChange={onChange}
      data={data}
      searchable
      // Deliberately NOT clearable: unlike an optional country, an event
      // with no timezone is meaningless.
      //
      // Mantine seeds the search box with the selected label and only
      // resets it on blur, so typing would APPEND to it
      // ("Africa/Accranew york"). Selecting the text on focus makes the
      // first keystroke replace it.
      onFocus={(event) => event.currentTarget.select()}
      nothingFoundMessage="No matching timezone"
      // Mantine v7's Select doesn't virtualize; ~420 option nodes on open
      // is a visible stall. `limit` applies after `filter`, so searching
      // still reaches every zone.
      limit={100}
      leftSection={
        selectedOffset ? (
          <Text size="xs" c="dimmed" aria-hidden="true">
            {selectedOffset}
          </Text>
        ) : undefined
      }
      leftSectionWidth={72}
      filter={({ options, search }) => {
        const query = search.trim().toLowerCase();
        if (!query) return options;

        return (options as ComboboxParsedItem[]).filter((option) => {
          if (!("value" in option)) return false;
          const tz = byId.get(option.value);
          return tz ? tz.searchText.includes(query) : option.value.toLowerCase().includes(query);
        });
      }}
      renderOption={({ option }) => {
        const tz = byId.get(option.value);
        return (
          <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
            <Text size="sm">
              {tz?.label ?? option.value}
              {tz?.region ? (
                <Text span size="xs" c="dimmed">
                  {" "}
                  · {tz.region}
                </Text>
              ) : null}
            </Text>
            <Text size="xs" c="dimmed">
              {tz?.offsetLabel}
            </Text>
          </Group>
        );
      }}
    />
  );
}
